/**
 * F24 — Interoperability hooks
 *
 * Cantera YAML import/export wired to the store.
 * CSV stream-table export is already handled by useExport (exportCsv).
 */
import { useCallback } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import { parseCantYaml } from '../io/canteraImporter';
import { paramsToCanteraYaml } from '../io/canteraExporter';

function downloadText(text: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export current kinetics as a Cantera YAML file. */
export function useExportCantera() {
  const params   = useSimulatorStore(s => s.params);
  const addToast = useSimulatorStore(s => s.addToast);

  return useCallback(() => {
    const yaml = paramsToCanteraYaml({
      k:              params.k,
      Ea:             params.Ea,
      T_ref:          params.T_ref,
      kinetics:       params.kinetics,
      customReaction: params.customReaction,
    });
    downloadText(yaml, 'kinetics.yaml', 'text/yaml');
    addToast('success', 'Kinetics exported to Cantera YAML.');
  }, [params, addToast]);
}

/** Import a Cantera YAML file; show a toast summary of what was parsed. */
export function useImportCantera() {
  const addToast = useSimulatorStore(s => s.addToast);

  return useCallback(() => {
    const input   = document.createElement('input');
    input.type    = 'file';
    input.accept  = '.yaml,.yml,.ck';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text   = await file.text();
      const result = parseCantYaml(text);

      const sp  = result.species.length;
      const rxn = result.reactions.length;
      const skp = result.skipped.length;
      addToast(
        'info',
        `Cantera import: ${sp} species, ${rxn} reactions${skp ? `, ${skp} skipped` : ''}.`,
      );
      // The parsed reactions are available in result.reactions for downstream use.
      // Full integration (overwriting the custom reaction) is an extension point;
      // for now the toast confirms the parse was successful.
    };
    input.click();
  }, [addToast]);
}
