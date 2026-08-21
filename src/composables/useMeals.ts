import { ref, computed, type Ref } from 'vue';
import { supabase } from '../lib/supabaseClient';
import { uuidv7 } from '../lib/uuidv7';
import { getLocalISODate } from '../lib/dateUtils';
import { offlineSync } from '../lib/offlineSync';
import type { Meal, Recipe, RecipeItem } from '../types/fitness';

export function useMeals(userId: Ref<string | undefined>, selectedDate: Ref<string>, loggedDates: Ref<string[]>) {
  const meals = ref<Meal[]>([]);
  const loading = ref(false);

  // Date-scoped meals matching selectedDate
  const filteredMeals = computed(() =>
    meals.value.filter((m) => (m.log_date || getLocalISODate(m.ts)) === selectedDate.value),
  );

  // Computed total nutritional macros on selectedDate
  const totalCaloriesConsumed = computed(() =>
    filteredMeals.value.reduce((acc, m) => acc + (m.cal || m.calories || 0), 0),
  );
  const totalProteinG = computed(() => filteredMeals.value.reduce((acc, m) => acc + (m.prot_g || m.protein_g || 0), 0));
  const totalCarbsG = computed(() => filteredMeals.value.reduce((acc, m) => acc + (m.carb_g || m.carbs_g || 0), 0));
  const totalFatG = computed(() => filteredMeals.value.reduce((acc, m) => acc + (m.fat_g || 0), 0));

  const fetchMeals = async (uid?: string) => {
    const targetUid = uid || userId.value;
    if (!targetUid) return;
    loading.value = true;
    const { data: mealRows } = await supabase
      .from<Meal>('meals')
      .select()
      .eq('user_id', targetUid)
      .order('log_date', { ascending: false })
      .order('id', { ascending: false })
      .get();

    if (mealRows) {
      const { data: microRows } = await supabase.from<any>('micronutrients').select().get();

      const microMap = new Map<string, any>();
      if (microRows) {
        microRows.forEach((r: any) => {
          if (r.meal_id) {
            const { meal_id, ...rest } = r;
            microMap.set(meal_id, rest);
          }
        });
      }

      meals.value = mealRows.map((m: Meal) => ({
        ...m,
        micros: m.id && microMap.has(m.id) ? microMap.get(m.id) : m.micros,
      }));

      mealRows.forEach((m: Meal) => {
        const d = m.log_date || getLocalISODate(m.ts);
        if (d && !loggedDates.value.includes(d)) {
          loggedDates.value.push(d);
        }
      });
    }
    loading.value = false;
  };

  const addMeal = async (mealData: Meal) => {
    if (!userId.value) return;
    const id = mealData.id || uuidv7();
    const payload: Meal = {
      ...mealData,
      id,
      user_id: userId.value,
      log_date: mealData.log_date || selectedDate.value,
    };
    meals.value.unshift(payload);
    if (!loggedDates.value.includes(payload.log_date || selectedDate.value)) {
      loggedDates.value.push(payload.log_date || selectedDate.value);
    }

    const isRecipe = !!((mealData.flags || 0) & 512);
    const isTemplated = !!mealData.template_id && !isRecipe;
    let finalFlags = mealData.flags || 0;
    if (isRecipe) finalFlags |= 512;

    const mealInsertPayload: any = {
      id,
      user_id: userId.value,
      name: isTemplated || isRecipe ? null : mealData.name,
      brand: isTemplated || isRecipe ? null : mealData.brand || null,
      cal: isTemplated || isRecipe ? null : Math.round(mealData.cal || mealData.calories || 0),
      prot_g: isTemplated || isRecipe ? null : Math.round((mealData.prot_g || mealData.protein_g || 0) * 10) / 10,
      carb_g: isTemplated || isRecipe ? null : Math.round((mealData.carb_g || mealData.carbs_g || 0) * 10) / 10,
      fat_g: isTemplated || isRecipe ? null : Math.round((mealData.fat_g || 0) * 10) / 10,
      flags: finalFlags,
      num_serv: mealData.num_serv || 1.0,
      serv_cal: isTemplated || isRecipe ? null : Math.round(mealData.cal || mealData.calories || 0),
      serv_prot: isTemplated || isRecipe ? null : Math.round((mealData.prot_g || mealData.protein_g || 0) * 10) / 10,
      serv_carb: isTemplated || isRecipe ? null : Math.round((mealData.carb_g || mealData.carbs_g || 0) * 10) / 10,
      serv_fat: isTemplated || isRecipe ? null : Math.round((mealData.fat_g || 0) * 10) / 10,
      template_id: mealData.template_id || null,
      log_date: payload.log_date,
    };

    try {
      const { error } = await supabase.from('meals').insert([mealInsertPayload]);
      if (error) {
        offlineSync.enqueue('meals', 'insert', mealInsertPayload);
      } else if (mealData.micros && Object.keys(mealData.micros).length > 0) {
        await supabase.from('micronutrients').insert([
          {
            meal_id: id,
            ...mealData.micros,
          },
        ]);
      }
    } catch {
      offlineSync.enqueue('meals', 'insert', mealInsertPayload);
    }
  };

  const editMeal = async (mealData: Meal) => {
    if (!userId.value || !mealData.id) return;
    const oldMeal = meals.value.find((m) => m.id === mealData.id);
    const isRecipe = !!((mealData.flags || 0) & 512);
    const isTemplated = !!mealData.template_id && !isRecipe;
    let finalFlags = mealData.flags || 0;
    if (isRecipe) finalFlags |= 512;

    let updatePayload: any = {};

    if (isTemplated || isRecipe) {
      if (oldMeal) {
        const ratio = (mealData.num_serv || 1) / (oldMeal.num_serv || 1);
        const calMatches = Math.abs((mealData.cal || 0) - (oldMeal.cal || 0) * ratio) < 1.5;
        const protMatches = Math.abs((mealData.prot_g || 0) - (oldMeal.prot_g || 0) * ratio) < 0.15;
        const carbMatches = Math.abs((mealData.carb_g || 0) - (oldMeal.carb_g || 0) * ratio) < 0.15;
        const fatMatches = Math.abs((mealData.fat_g || 0) - (oldMeal.fat_g || 0) * ratio) < 0.15;

        updatePayload = {
          name: mealData.name === oldMeal.name ? null : mealData.name,
          brand: mealData.brand === oldMeal.brand ? null : mealData.brand || null,
          cal: calMatches ? null : Math.round(mealData.cal || 0),
          prot_g: protMatches ? null : Math.round((mealData.prot_g || 0) * 10) / 10,
          carb_g: carbMatches ? null : Math.round((mealData.carb_g || 0) * 10) / 10,
          fat_g: fatMatches ? null : Math.round((mealData.fat_g || 0) * 10) / 10,
          flags: finalFlags,
          num_serv: mealData.num_serv || 1.0,
          serv_cal: calMatches ? null : Math.round(mealData.cal || 0),
          serv_prot: protMatches ? null : Math.round((mealData.prot_g || 0) * 10) / 10,
          serv_carb: carbMatches ? null : Math.round((mealData.carb_g || 0) * 10) / 10,
          serv_fat: fatMatches ? null : Math.round((mealData.fat_g || 0) * 10) / 10,
          template_id: mealData.template_id || null,
        };
      } else {
        updatePayload = {
          name: null,
          brand: null,
          cal: null,
          prot_g: null,
          carb_g: null,
          fat_g: null,
          flags: finalFlags,
          num_serv: mealData.num_serv || 1.0,
          serv_cal: null,
          serv_prot: null,
          serv_carb: null,
          serv_fat: null,
          template_id: mealData.template_id || null,
        };
      }
    } else {
      updatePayload = {
        name: mealData.name,
        brand: mealData.brand || null,
        cal: Math.round(mealData.cal || mealData.calories || 0),
        prot_g: Math.round((mealData.prot_g || mealData.protein_g || 0) * 10) / 10,
        carb_g: Math.round((mealData.carb_g || mealData.carbs_g || 0) * 10) / 10,
        fat_g: Math.round((mealData.fat_g || 0) * 10) / 10,
        flags: finalFlags,
        num_serv: mealData.num_serv || 1.0,
        serv_cal: Math.round(mealData.cal || mealData.calories || 0),
        serv_prot: Math.round((mealData.prot_g || mealData.protein_g || 0) * 10) / 10,
        serv_carb: Math.round((mealData.carb_g || mealData.carbs_g || 0) * 10) / 10,
        serv_fat: Math.round((mealData.fat_g || 0) * 10) / 10,
        template_id: null,
      };
    }

    const idx = meals.value.findIndex((m) => m.id === mealData.id);
    if (idx !== -1) {
      meals.value[idx] = { ...meals.value[idx], ...mealData };
    }

    try {
      const { error } = await supabase.from('meals').update(updatePayload).eq('id', mealData.id);

      if (error) {
        offlineSync.enqueue('meals', 'update', { id: mealData.id, ...updatePayload });
      } else if (mealData.micros && Object.keys(mealData.micros).length > 0) {
        await supabase.from('micronutrients').upsert({
          meal_id: mealData.id,
          ...mealData.micros,
        });
      }
    } catch {
      offlineSync.enqueue('meals', 'update', { id: mealData.id, ...updatePayload });
    }
  };

  const deleteMeal = async (id: string) => {
    if (!userId.value || !id) return;
    const idx = meals.value.findIndex((m) => m.id === id);
    if (idx !== -1) {
      meals.value.splice(idx, 1);
    }

    try {
      const { error } = await supabase.from('meals').delete().eq('id', id);
      if (error) {
        offlineSync.enqueue('meals', 'delete', { id });
      }
    } catch {
      offlineSync.enqueue('meals', 'delete', { id });
    }
  };

  // Recipes & Coupled Meal Templates State
  const recipes = ref<Recipe[]>([]);

  const fetchRecipes = async (uid?: string) => {
    const targetUid = uid || userId.value;
    if (!targetUid) return;
    const { data: recipeData } = await supabase
      .from<Recipe>('recipes')
      .select()
      .eq('user_id', targetUid)
      .order('name', { ascending: true })
      .get();

    if (recipeData && recipeData.length > 0) {
      const [itemsRes, microsRes] = await Promise.all([
        supabase.from<RecipeItem>('v_recipe_items').select().get(),
        supabase.from<any>('recipe_micronutrients').select().get(),
      ]);

      const itemsByRecipe: Record<string, RecipeItem[]> = {};
      if (itemsRes.data) {
        itemsRes.data.forEach((item: RecipeItem) => {
          if (item.recipe_id) {
            if (!itemsByRecipe[item.recipe_id]) itemsByRecipe[item.recipe_id] = [];
            itemsByRecipe[item.recipe_id].push(item);
          }
        });
      }

      const microsByRecipe: Record<string, Record<string, number>> = {};
      if (microsRes.data) {
        microsRes.data.forEach((m: any) => {
          if (m.recipe_id) {
            const { id: _id, recipe_id: _rid, ...rest } = m;
            microsByRecipe[m.recipe_id] = rest;
          }
        });
      }

      recipes.value = recipeData.map((r: any) => ({
        ...r,
        items: r.id ? itemsByRecipe[r.id] || [] : [],
        micros: r.id ? microsByRecipe[r.id] : undefined,
      }));
    } else if (recipeData) {
      recipes.value = [];
    }
  };

  const addRecipe = async (recipeData: Partial<Recipe>) => {
    if (!userId.value) return;
    const id = recipeData.id || uuidv7();
    const payload: Recipe = {
      id,
      user_id: userId.value,
      name: recipeData.name || 'Custom Meal Combo',
      description: recipeData.description || null,
      cal: Math.round(recipeData.cal || 0),
      prot_g: Math.round((recipeData.prot_g || 0) * 10) / 10,
      carb_g: Math.round((recipeData.carb_g || 0) * 10) / 10,
      fat_g: Math.round((recipeData.fat_g || 0) * 10) / 10,
      num_serv: Math.max(0.1, Math.round(Number(recipeData.num_serv || 1) * 10) / 10),
      serv_cal: recipeData.serv_cal !== undefined ? Math.round(recipeData.serv_cal) : null,
      serv_prot: recipeData.serv_prot !== undefined ? Math.round(recipeData.serv_prot) : null,
      serv_carb: recipeData.serv_carb !== undefined ? Math.round(recipeData.serv_carb) : null,
      serv_fat: recipeData.serv_fat !== undefined ? Math.round(recipeData.serv_fat) : null,
      flags: recipeData.flags || 0,
      is_public: recipeData.is_public || false,
    };

    const createdRecipe: Recipe = {
      ...payload,
      items: recipeData.items || [],
      micros: recipeData.micros,
    };

    recipes.value.unshift(createdRecipe);

    try {
      const { error } = await supabase.from('recipes').insert(payload);
      if (error) {
        offlineSync.enqueue('recipes', 'insert', payload);
      }

      // Insert constituent items if present
      if (recipeData.items && recipeData.items.length > 0) {
        for (const item of recipeData.items) {
          const hasTemplate = !!item.template_id;
          const itemPayload = {
            id: item.id || uuidv7(),
            recipe_id: id,
            template_id: item.template_id || null,
            item_name: hasTemplate ? null : (item.item_name || item.name || 'Ingredient'),
            amount: Number(item.amount) || 1,
            unit: item.unit || 'g',
            cal: hasTemplate ? null : Math.round(item.cal || 0),
            prot_g: hasTemplate ? null : Math.round((item.prot_g || 0) * 10) / 10,
            carb_g: hasTemplate ? null : Math.round((item.carb_g || 0) * 10) / 10,
            fat_g: hasTemplate ? null : Math.round((item.fat_g || 0) * 10) / 10,
          };
          await supabase.from('recipe_items').insert(itemPayload);
        }
      }

      // Persist opt-in recipe micronutrients if provided
      if (recipeData.micros && Object.keys(recipeData.micros).length > 0) {
        await supabase.from('recipe_micronutrients').insert({
          recipe_id: id,
          ...recipeData.micros,
        });
      }
    } catch {
      offlineSync.enqueue('recipes', 'insert', payload);
    }
    return createdRecipe;
  };

  const editRecipe = async (recipeData: Recipe) => {
    if (!userId.value || !recipeData.id) return;
    const payload = {
      name: recipeData.name,
      description: recipeData.description || null,
      cal: Math.round(recipeData.cal || 0),
      prot_g: Math.round((recipeData.prot_g || 0) * 10) / 10,
      carb_g: Math.round((recipeData.carb_g || 0) * 10) / 10,
      fat_g: Math.round((recipeData.fat_g || 0) * 10) / 10,
      num_serv: Math.max(0.1, Math.round(Number(recipeData.num_serv || 1) * 10) / 10),
      serv_cal: recipeData.serv_cal !== undefined ? Math.round(recipeData.serv_cal) : null,
      serv_prot: recipeData.serv_prot !== undefined ? Math.round(recipeData.serv_prot) : null,
      serv_carb: recipeData.serv_carb !== undefined ? Math.round(recipeData.serv_carb) : null,
      serv_fat: recipeData.serv_fat !== undefined ? Math.round(recipeData.serv_fat) : null,
    };

    const idx = recipes.value.findIndex((r: Recipe) => r.id === recipeData.id);
    if (idx !== -1) {
      recipes.value[idx] = { ...recipes.value[idx], ...recipeData, ...payload };
    }

    try {
      const { error } = await supabase.from('recipes').update(payload).eq('id', recipeData.id);
      if (error) {
        offlineSync.enqueue('recipes', 'update', { id: recipeData.id, ...payload });
      }

      // Re-insert constituent items if updated
      if (recipeData.items) {
        await supabase.from('recipe_items').delete().eq('recipe_id', recipeData.id);
        for (const item of recipeData.items) {
          const hasTemplate = !!item.template_id;
          const itemPayload: RecipeItem = {
            id: item.id || uuidv7(),
            recipe_id: recipeData.id,
            template_id: item.template_id || null,
            item_name: hasTemplate ? null : (item.item_name || item.name || 'Ingredient'),
            amount: item.amount || 1,
            unit: item.unit || 'serving',
            cal: hasTemplate ? null : (item.cal || 0),
            prot_g: hasTemplate ? null : (item.prot_g || 0),
            carb_g: hasTemplate ? null : (item.carb_g || 0),
            fat_g: hasTemplate ? null : (item.fat_g || 0),
          };
          await supabase.from('recipe_items').insert(itemPayload);
        }
      }

      // Re-insert opt-in recipe micronutrients if updated
      if (recipeData.micros) {
        await supabase.from('recipe_micronutrients').delete().eq('recipe_id', recipeData.id);
        if (Object.keys(recipeData.micros).length > 0) {
          await supabase.from('recipe_micronutrients').insert({
            recipe_id: recipeData.id,
            ...recipeData.micros,
          });
        }
      }
    } catch {
      offlineSync.enqueue('recipes', 'update', { id: recipeData.id, ...payload });
    }
  };

  const deleteRecipe = async (recipeId: string) => {
    if (!userId.value || !recipeId) return;
    const idx = recipes.value.findIndex((r: Recipe) => r.id === recipeId);
    if (idx !== -1) {
      recipes.value.splice(idx, 1);
    }

    try {
      const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
      if (error) {
        offlineSync.enqueue('recipes', 'delete', { id: recipeId });
      }
    } catch {
      offlineSync.enqueue('recipes', 'delete', { id: recipeId });
    }
  };

  const logRecipeAsMeal = async (recipe: Recipe, targetSlot: number, dateStr?: string, multiplier: number = 1) => {
    if (!userId.value) return;
    const servCal = recipe.serv_cal ?? recipe.cal;
    const mealCal = Math.round(servCal * multiplier);
    const mealPayload: Meal = {
      user_id: userId.value,
      name: recipe.name,
      brand: null,
      cal: mealCal,
      prot_g: Math.round((recipe.serv_prot ?? recipe.prot_g) * multiplier),
      carb_g: Math.round((recipe.serv_carb ?? recipe.carb_g) * multiplier),
      fat_g: Math.round((recipe.serv_fat ?? recipe.fat_g) * multiplier),
      num_serv: multiplier,
      serv_cal: Math.round(servCal),
      serv_prot: Math.round(recipe.serv_prot ?? recipe.prot_g),
      serv_carb: Math.round(recipe.serv_carb ?? recipe.carb_g),
      serv_fat: Math.round(recipe.serv_fat ?? recipe.fat_g),
      template_id: recipe.id,
      flags: targetSlot | 512,
      log_date: dateStr || selectedDate.value,
      micros: recipe.micros,
    };
    await addMeal(mealPayload);
  };

  const logTemplateAsMeal = async (template: any, targetSlot: number, dateStr?: string, multiplier: number = 1) => {
    if (!userId.value) return;
    const servCal = template.serv_cal ?? template.cal;
    const mealCal = Math.round(servCal * multiplier);
    const mealPayload: Meal = {
      user_id: userId.value,
      name: template.name,
      brand: template.brand || null,
      cal: mealCal,
      prot_g: Math.round((template.serv_prot ?? template.prot_g) * multiplier),
      carb_g: Math.round((template.serv_carb ?? template.carb_g) * multiplier),
      fat_g: Math.round((template.serv_fat ?? template.fat_g) * multiplier),
      num_serv: multiplier,
      serv_cal: Math.round(servCal),
      serv_prot: Math.round(template.serv_prot ?? template.prot_g),
      serv_carb: Math.round(template.serv_carb ?? template.carb_g),
      serv_fat: Math.round(template.serv_fat ?? template.fat_g),
      template_id: template.id,
      flags: targetSlot,
      log_date: dateStr || selectedDate.value,
      micros: template.micros,
    };
    await addMeal(mealPayload);
  };

  const shareRecipeToHandle = async (recipeId: string, handle: string) => {
    if (!userId.value || !recipeId || !handle.trim()) {
      return { success: false, error: 'Missing parameters' };
    }

    try {
      const { data, error } = await supabase.rpc('share_recipe_to_handle', {
        p_recipe_id: recipeId,
        p_target_handle: handle.trim().replace(/^@/, ''),
      });
      if (error) {
        return { success: false, error: error.message || 'Failed to share recipe' };
      }
      return data || { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to share recipe' };
    }
  };

  return {
    meals,
    filteredMeals,
    recipes,
    templates: recipes, // Backwards compatible alias
    totalCaloriesConsumed,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    loading,
    fetchMeals,
    fetchRecipes,
    fetchTemplates: fetchRecipes,
    addMeal,
    editMeal,
    deleteMeal,
    addRecipe,
    addTemplate: addRecipe,
    editRecipe,
    editTemplate: editRecipe,
    deleteRecipe,
    deleteTemplate: deleteRecipe,
    shareRecipeToHandle,
    shareTemplateToHandle: shareRecipeToHandle,
    logRecipeAsMeal,
    logTemplateAsMeal,
  };
}
