import { ref, computed } from 'vue';
import { supabase } from '../lib/supabaseClient';
import { offlineSync } from '../lib/offlineSync';
import { uuidv7 } from '../lib/uuidv7';
import type { FoodTemplate, UserFavoriteTemplate, Micronutrients } from '../types/fitness';

// Shared singleton state across all components and views
const favoriteTemplates = ref<UserFavoriteTemplate[]>([]);
const loading = ref(false);

export function useFoodTemplates(userIdRef?: { value: string | undefined }) {
  const favoriteIds = computed(() => new Set(favoriteTemplates.value.map((f) => f.template_id)));

  const isFavorited = (templateId: string) => favoriteIds.value.has(templateId);

  const fetchFavorites = async (uid?: string) => {
    const targetUid = uid || userIdRef?.value;
    if (!targetUid) return;
    loading.value = true;

    try {
      // 1. Fetch user favorite junction records
      const { data: favRows } = await supabase
        .from<any>('user_favorite_templates')
        .select()
        .eq('user_id', targetUid)
        .order('created_at', { ascending: false })
        .get();

      if (!favRows || favRows.length === 0) {
        favoriteTemplates.value = [];
        loading.value = false;
        return;
      }

      const templateIds = favRows.map((f: any) => f.template_id).filter(Boolean);
      if (templateIds.length === 0) {
        favoriteTemplates.value = [];
        loading.value = false;
        return;
      }

      // 2. Fetch corresponding templates & custom user micro overrides & base template micros
      const [tmplRes, customMicroRes, baseMicroRes] = await Promise.all([
        supabase.from<any>('meal_templates').select().in('id', templateIds).get(),
        supabase
          .from<any>('user_favorite_template_micronutrients')
          .select()
          .eq('user_id', targetUid)
          .in('template_id', templateIds)
          .get(),
        supabase.from<any>('meal_template_micronutrients').select().in('template_id', templateIds).get(),
      ]);

      const tmplMap = new Map<string, FoodTemplate>();
      if (tmplRes.data) {
        for (const t of tmplRes.data) {
          tmplMap.set(t.id, {
            id: t.id,
            user_id: t.user_id,
            name: t.name,
            brand: t.brand,
            cal: t.cal || 0,
            prot_g: t.prot_g || 0,
            carb_g: t.carb_g || 0,
            fat_g: t.fat_g || 0,
            num_serv: t.num_serv || 1,
            serv_cal: t.serv_cal ?? null,
            serv_prot: t.serv_prot ?? null,
            serv_carb: t.serv_carb ?? null,
            serv_fat: t.serv_fat ?? null,
            is_public: !!t.is_public,
            is_favorite: true,
          });
        }
      }

      if (baseMicroRes.data) {
        for (const m of baseMicroRes.data) {
          const t = tmplMap.get(m.template_id);
          if (t) {
            const { template_id, ...microsOnly } = m;
            t.micros = microsOnly;
          }
        }
      }

      const customMicroMap = new Map<string, Micronutrients>();
      if (customMicroRes.data) {
        for (const m of customMicroRes.data) {
          const { user_id, template_id, ...microsOnly } = m;
          customMicroMap.set(template_id, microsOnly);
        }
      }

      favoriteTemplates.value = favRows
        .map((f: any) => {
          const t = tmplMap.get(f.template_id);
          const customMicros = customMicroMap.get(f.template_id);
          return {
            user_id: f.user_id,
            template_id: f.template_id,
            custom_micros: customMicros || null,
            created_at: f.created_at,
            template: t,
          };
        })
        .filter((f: any) => !!f.template);
    } catch {
      // Fallback
    } finally {
      loading.value = false;
    }
  };

  const upsertFoodTemplate = async (data: {
    name: string;
    brand?: string | null;
    cal: number;
    prot_g: number;
    carb_g: number;
    fat_g: number;
    num_serv?: number;
    is_public?: boolean;
    micros?: Micronutrients;
  }): Promise<string | null> => {
    const uid = userIdRef?.value;
    const id = uuidv7();
    const isPublic = data.is_public ?? false;
    const ownerId = isPublic ? null : uid || null;

    const payload = {
      id,
      user_id: ownerId,
      name: data.name.trim(),
      brand: data.brand?.trim() || null,
      cal: Math.round(data.cal || 0),
      prot_g: Math.round((data.prot_g || 0) * 10) / 10,
      carb_g: Math.round((data.carb_g || 0) * 10) / 10,
      fat_g: Math.round((data.fat_g || 0) * 10) / 10,
      num_serv: data.num_serv || 1,
      is_public: isPublic,
    };

    try {
      const { error } = await supabase.from('meal_templates').insert([payload]);
      if (error) {
        offlineSync.enqueue('meal_templates', 'insert', payload);
      } else if (data.micros && Object.keys(data.micros).length > 0) {
        await supabase.from('meal_template_micronutrients').insert([
          {
            template_id: id,
            ...data.micros,
          },
        ]);
      }
      return id;
    } catch {
      offlineSync.enqueue('meal_templates', 'insert', payload);
      return id;
    }
  };

  const toggleFavorite = async (templateId: string, customMicros?: Micronutrients | null) => {
    const uid = userIdRef?.value;
    if (!uid || !templateId) return;

    const alreadyFav = isFavorited(templateId);

    if (alreadyFav) {
      // Unfavorite
      favoriteTemplates.value = favoriteTemplates.value.filter((f) => f.template_id !== templateId);
      try {
        await supabase
          .from('user_favorite_template_micronutrients')
          .delete()
          .eq('user_id', uid)
          .eq('template_id', templateId);

        const { error } = await supabase
          .from('user_favorite_templates')
          .delete()
          .eq('user_id', uid)
          .eq('template_id', templateId);

        if (error) {
          offlineSync.enqueue('user_favorite_templates', 'delete', {
            id: `${uid}_${templateId}`,
            user_id: uid,
            template_id: templateId,
          });
        }
      } catch {
        offlineSync.enqueue('user_favorite_templates', 'delete', {
          id: `${uid}_${templateId}`,
          user_id: uid,
          template_id: templateId,
        });
      }
    } else {
      // Favorite
      const junctionPayload = {
        user_id: uid,
        template_id: templateId,
        created_at: new Date().toISOString(),
      };

      const favState: UserFavoriteTemplate = {
        ...junctionPayload,
        custom_micros: customMicros || null,
      };

      favoriteTemplates.value.unshift(favState);

      try {
        const { error } = await supabase.from('user_favorite_templates').insert([junctionPayload]);

        if (error) {
          offlineSync.enqueue('user_favorite_templates', 'insert', { id: `${uid}_${templateId}`, ...junctionPayload });
        } else if (customMicros && Object.keys(customMicros).length > 0) {
          await supabase.from('user_favorite_template_micronutrients').insert([
            {
              user_id: uid,
              template_id: templateId,
              ...customMicros,
            },
          ]);
        }
      } catch {
        offlineSync.enqueue('user_favorite_templates', 'insert', { id: `${uid}_${templateId}`, ...junctionPayload });
      }
    }

    // Immediately refresh state in background to ensure full relational hydration
    await fetchFavorites(uid);
  };

  return {
    favoriteTemplates,
    loading,
    isFavorited,
    fetchFavorites,
    upsertFoodTemplate,
    toggleFavorite,
  };
}
