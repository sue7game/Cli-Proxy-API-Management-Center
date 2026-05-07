import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFilesApi, type AuthFileFieldsPatch } from '@/services/api';
import type { AuthFileItem } from '@/types';
import { useNotificationStore } from '@/stores';
import { parseDisableCoolingValue, parsePriorityValue } from '@/features/authFiles/constants';

type AuthFileHeaders = Record<string, string>;
type AuthFileHeadersErrorKey =
  | 'auth_files.headers_invalid_json'
  | 'auth_files.headers_invalid_object'
  | 'auth_files.headers_invalid_value';
type PrefixProxyEditorErrorKey =
  | AuthFileHeadersErrorKey
  | 'auth_files.auto_429_invalid_integer'
  | 'auth_files.disable_cooling_invalid_bool';

export type PrefixProxyEditorField =
  | 'prefix'
  | 'proxyUrl'
  | 'priority'
  | 'disableCooling'
  | 'note'
  | 'headersText'
  | 'autoDisable429Threshold'
  | 'auto429RecheckInterval';

export type PrefixProxyEditorFieldValue = string;

export type PrefixProxyEditorState = {
  fileName: string;
  fileInfoText: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  originalText: string;
  rawText: string;
  json: Record<string, unknown> | null;
  prefix: string;
  proxyUrl: string;
  priority: string;
  disableCooling: string;
  disableCoolingError: string | null;
  autoDisable429Threshold: string;
  auto429RecheckInterval: string;
  auto429Error: string | null;
  note: string;
  noteTouched: boolean;
  headersText: string;
  headersTouched: boolean;
  headersError: string | null;
};

export type UseAuthFilesPrefixProxyEditorOptions = {
  disableControls: boolean;
  loadFiles: () => Promise<void>;
};

export type UseAuthFilesPrefixProxyEditorResult = {
  prefixProxyEditor: PrefixProxyEditorState | null;
  prefixProxyUpdatedText: string;
  prefixProxyDirty: boolean;
  openPrefixProxyEditor: (file: AuthFileItem) => Promise<void>;
  closePrefixProxyEditor: () => void;
  handlePrefixProxyChange: (
    field: PrefixProxyEditorField,
    value: PrefixProxyEditorFieldValue
  ) => void;
  handlePrefixProxySave: () => Promise<void>;
};

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validateHeadersValue = (value: unknown): AuthFileHeadersErrorKey | null => {
  if (!isRecordObject(value)) {
    return 'auth_files.headers_invalid_object';
  }
  return Object.values(value).every((item) => typeof item === 'string')
    ? null
    : 'auth_files.headers_invalid_value';
};

const parseHeadersText = (
  text: string
): { value: AuthFileHeaders | null; errorKey: AuthFileHeadersErrorKey | null } => {
  const trimmed = text.trim();
  if (!trimmed) {
    return { value: null, errorKey: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { value: null, errorKey: 'auth_files.headers_invalid_json' };
  }

  const errorKey = validateHeadersValue(parsed);
  if (errorKey) {
    return { value: null, errorKey };
  }

  return { value: parsed as AuthFileHeaders, errorKey: null };
};

const normalizeTextField = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readDisableCoolingValue = (value: Record<string, unknown>): boolean | undefined =>
  parseDisableCoolingValue(value.disable_cooling ?? value['disable-cooling']);

const normalizeDisableCoolingText = (value: Record<string, unknown>): string => {
  const parsed = readDisableCoolingValue(value);
  return parsed === undefined ? '' : String(parsed);
};

const normalizeIntegerField = (value: unknown, fallback: number): number => {
  const parsed = parsePriorityValue(value);
  return parsed !== undefined ? parsed : fallback;
};

const normalizeAuto429Threshold = (value: unknown): number => {
  const parsed = normalizeIntegerField(value, 0);
  return parsed > 0 ? parsed : 0;
};

const normalizeAuto429RecheckInterval = (value: unknown): number => {
  const parsed = normalizeIntegerField(value, 600);
  return parsed > 0 ? parsed : 600;
};

const parseIntegerInput = (
  text: string,
  fallback: number,
  resolveError: (key: PrefixProxyEditorErrorKey) => string
): number => {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  const parsed = parsePriorityValue(trimmed);
  if (parsed === undefined) {
    throw new Error(resolveError('auth_files.auto_429_invalid_integer'));
  }
  return parsed;
};

const parseAuto429ThresholdInput = (
  text: string,
  resolveError: (key: PrefixProxyEditorErrorKey) => string
): number => {
  const parsed = parseIntegerInput(text, 0, resolveError);
  return parsed > 0 ? parsed : 0;
};

const parseAuto429RecheckIntervalInput = (
  text: string,
  resolveError: (key: PrefixProxyEditorErrorKey) => string
): number => {
  const parsed = parseIntegerInput(text, 600, resolveError);
  return parsed > 0 ? parsed : 600;
};

const validateIntegerInput = (
  text: string,
  resolveError: (key: PrefixProxyEditorErrorKey) => string
): string | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return parsePriorityValue(trimmed) === undefined
    ? resolveError('auth_files.auto_429_invalid_integer')
    : null;
};

const parseDisableCoolingInput = (
  text: string,
  resolveError: (key: PrefixProxyEditorErrorKey) => string
): boolean | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const parsed = parseDisableCoolingValue(trimmed);
  if (parsed === undefined) {
    throw new Error(resolveError('auth_files.disable_cooling_invalid_bool'));
  }
  return parsed;
};

const validateDisableCoolingInput = (
  text: string,
  resolveError: (key: PrefixProxyEditorErrorKey) => string
): string | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return parseDisableCoolingValue(trimmed) === undefined
    ? resolveError('auth_files.disable_cooling_invalid_bool')
    : null;
};

const hasKeys = (value: Record<string, unknown> | AuthFileFieldsPatch | null): boolean =>
  Boolean(value && Object.keys(value).length > 0);

const normalizeHeaders = (value: unknown): AuthFileHeaders => {
  if (!isRecordObject(value)) return {};

  return Object.entries(value).reduce<AuthFileHeaders>((result, [key, rawValue]) => {
    if (typeof rawValue !== 'string') return result;
    const name = key.trim();
    const headerValue = rawValue.trim();
    if (!name || !headerValue) return result;
    result[name] = headerValue;
    return result;
  }, {});
};

const buildHeadersPatch = (
  originalHeaders: AuthFileHeaders,
  nextHeaders: AuthFileHeaders
): AuthFileHeaders | undefined => {
  const patch: AuthFileHeaders = {};
  const nextNames = new Set(Object.keys(nextHeaders));

  Object.entries(nextHeaders).forEach(([name, value]) => {
    if (originalHeaders[name] !== value) {
      patch[name] = value;
    }
  });

  Object.keys(originalHeaders).forEach((name) => {
    if (!nextNames.has(name)) {
      patch[name] = '';
    }
  });

  return Object.keys(patch).length > 0 ? patch : undefined;
};

const applyHeadersPatch = (
  value: Record<string, unknown>,
  headersPatch: AuthFileHeaders | undefined
) => {
  if (!headersPatch) return;

  const nextHeaders = normalizeHeaders(value.headers);
  Object.entries(headersPatch).forEach(([name, rawValue]) => {
    const headerName = name.trim();
    if (!headerName) return;
    const headerValue = rawValue.trim();
    if (!headerValue) {
      delete nextHeaders[headerName];
      return;
    }
    nextHeaders[headerName] = headerValue;
  });

  if (Object.keys(nextHeaders).length > 0) {
    value.headers = nextHeaders;
  } else {
    delete value.headers;
  }
};

const buildAuthFileFieldsPatch = (
  editor: PrefixProxyEditorState,
  resolveError: (key: PrefixProxyEditorErrorKey) => string
): AuthFileFieldsPatch => {
  const original = editor.json ?? {};
  const patch: AuthFileFieldsPatch = {};

  const originalPrefix = normalizeTextField(original.prefix);
  const nextPrefix = editor.prefix.trim();
  if (nextPrefix !== originalPrefix) {
    patch.prefix = nextPrefix;
  }

  const originalProxyURL = normalizeTextField(original.proxy_url);
  const nextProxyURL = editor.proxyUrl.trim();
  if (nextProxyURL !== originalProxyURL) {
    patch.proxy_url = nextProxyURL;
  }

  const originalPriority = parsePriorityValue(original.priority);
  const priorityText = editor.priority.trim();
  const nextPriority = parsePriorityValue(priorityText);
  if (!priorityText) {
    if (originalPriority !== undefined && originalPriority !== 0) {
      patch.priority = 0;
    }
  } else if (nextPriority !== undefined) {
    if (nextPriority === 0) {
      if (originalPriority !== undefined && originalPriority !== 0) {
        patch.priority = 0;
      }
    } else if (nextPriority !== originalPriority) {
      patch.priority = nextPriority;
    }
  }

  const originalDisableCooling = readDisableCoolingValue(original);
  const nextDisableCooling = parseDisableCoolingInput(editor.disableCooling, resolveError);
  if (nextDisableCooling !== undefined && nextDisableCooling !== originalDisableCooling) {
    patch.disable_cooling = nextDisableCooling;
  }

  if (editor.noteTouched) {
    const originalNote = normalizeTextField(original.note);
    const nextNote = editor.note.trim();
    if (nextNote !== originalNote) {
      patch.note = nextNote;
    }
  }

  if (editor.headersTouched) {
    const { value: parsedHeaders, errorKey } = parseHeadersText(editor.headersText);
    if (errorKey) {
      throw new Error(resolveError(errorKey));
    }
    const headersPatch = buildHeadersPatch(
      normalizeHeaders(original.headers),
      normalizeHeaders(parsedHeaders ?? {})
    );
    if (headersPatch) {
      patch.headers = headersPatch;
    }
  }

  const originalThreshold = normalizeAuto429Threshold(original.auto_disable_429_threshold);
  const nextThreshold = parseAuto429ThresholdInput(editor.autoDisable429Threshold, resolveError);
  if (nextThreshold !== originalThreshold) {
    patch.auto_disable_429_threshold = nextThreshold;
  }

  const originalRecheckInterval = normalizeAuto429RecheckInterval(
    original.auto_429_recheck_interval
  );
  const nextRecheckInterval = parseAuto429RecheckIntervalInput(
    editor.auto429RecheckInterval,
    resolveError
  );
  if (nextRecheckInterval !== originalRecheckInterval) {
    patch.auto_429_recheck_interval = nextRecheckInterval;
  }

  return patch;
};

const buildPrefixProxyUpdatedText = (
  editor: PrefixProxyEditorState | null,
  resolveError: (key: PrefixProxyEditorErrorKey) => string
): string => {
  if (!editor?.json) return editor?.rawText ?? '';
  const patch = buildAuthFileFieldsPatch(editor, resolveError);
  const next: Record<string, unknown> = { ...editor.json };
  if (patch.prefix !== undefined) {
    if (patch.prefix) {
      next.prefix = patch.prefix;
    } else {
      delete next.prefix;
    }
  }
  if (patch.proxy_url !== undefined) {
    if (patch.proxy_url) {
      next.proxy_url = patch.proxy_url;
    } else {
      delete next.proxy_url;
    }
  }

  if (patch.priority !== undefined) {
    if (patch.priority === 0) {
      delete next.priority;
    } else {
      next.priority = patch.priority;
    }
  }

  if (patch.disable_cooling !== undefined) {
    next.disable_cooling = patch.disable_cooling;
    delete next['disable-cooling'];
  }

  if (patch.note !== undefined) {
    if (patch.note) {
      next.note = patch.note;
    } else if ('note' in next) {
      delete next.note;
    }
  }

  applyHeadersPatch(next, patch.headers);
  if (patch.auto_disable_429_threshold !== undefined) {
    next.auto_disable_429_threshold = patch.auto_disable_429_threshold;
  }
  if (patch.auto_429_recheck_interval !== undefined) {
    next.auto_429_recheck_interval = patch.auto_429_recheck_interval;
  }

  return JSON.stringify(next);
};

export function useAuthFilesPrefixProxyEditor(
  options: UseAuthFilesPrefixProxyEditorOptions
): UseAuthFilesPrefixProxyEditorResult {
  const { disableControls, loadFiles } = options;
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);

  const [prefixProxyEditor, setPrefixProxyEditor] = useState<PrefixProxyEditorState | null>(null);

  const hasBlockingValidationError = Boolean(
    (prefixProxyEditor?.headersTouched && prefixProxyEditor.headersError) ||
    prefixProxyEditor?.disableCoolingError ||
    prefixProxyEditor?.auto429Error
  );
  const prefixProxyUpdatedText =
    prefixProxyEditor?.json && !hasBlockingValidationError
      ? buildPrefixProxyUpdatedText(prefixProxyEditor, (key) => t(key))
      : '';

  const prefixProxyPatch =
    prefixProxyEditor?.json && !hasBlockingValidationError
      ? buildAuthFileFieldsPatch(prefixProxyEditor, (key) => t(key))
      : null;

  const prefixProxyDirty = hasKeys(prefixProxyPatch);

  const closePrefixProxyEditor = () => {
    setPrefixProxyEditor(null);
  };

  const openPrefixProxyEditor = async (file: AuthFileItem) => {
    const name = file.name;

    if (disableControls) return;
    if (prefixProxyEditor?.fileName === name) {
      setPrefixProxyEditor(null);
      return;
    }

    setPrefixProxyEditor({
      fileName: name,
      fileInfoText: JSON.stringify(file, null, 2),
      loading: true,
      saving: false,
      error: null,
      originalText: '',
      rawText: '',
      json: null,
      prefix: '',
      proxyUrl: '',
      priority: '',
      disableCooling: '',
      disableCoolingError: null,
      autoDisable429Threshold: '0',
      auto429RecheckInterval: '600',
      auto429Error: null,
      note: '',
      noteTouched: false,
      headersText: '',
      headersTouched: false,
      headersError: null,
    });

    try {
      const rawText = await authFilesApi.downloadText(name);
      const trimmed = rawText.trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed) as unknown;
      } catch {
        setPrefixProxyEditor((prev) => {
          if (!prev || prev.fileName !== name) return prev;
          return {
            ...prev,
            loading: false,
            error: t('auth_files.prefix_proxy_invalid_json'),
            rawText: trimmed,
            originalText: trimmed,
          };
        });
        return;
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setPrefixProxyEditor((prev) => {
          if (!prev || prev.fileName !== name) return prev;
          return {
            ...prev,
            loading: false,
            error: t('auth_files.prefix_proxy_invalid_json'),
            rawText: trimmed,
            originalText: trimmed,
          };
        });
        return;
      }

      const json = { ...(parsed as Record<string, unknown>) };
      const originalText = JSON.stringify(json);
      const prefix = typeof json.prefix === 'string' ? json.prefix : '';
      const proxyUrl = typeof json.proxy_url === 'string' ? json.proxy_url : '';
      const priority = parsePriorityValue(json.priority);
      const disableCooling = normalizeDisableCoolingText(json);
      const autoDisable429Threshold = normalizeAuto429Threshold(json.auto_disable_429_threshold);
      const auto429RecheckInterval = normalizeAuto429RecheckInterval(
        json.auto_429_recheck_interval
      );
      const note = typeof json.note === 'string' ? json.note : '';
      const headers = json.headers;
      let headersText = '';
      let headersError: string | null = null;
      if (headers !== undefined) {
        headersText = JSON.stringify(headers, null, 2);
        const { errorKey } = parseHeadersText(headersText);
        headersError = errorKey ? t(errorKey) : null;
      }

      setPrefixProxyEditor((prev) => {
        if (!prev || prev.fileName !== name) return prev;
        return {
          ...prev,
          loading: false,
          originalText,
          rawText: originalText,
          json,
          prefix,
          proxyUrl,
          priority: priority !== undefined ? String(priority) : '',
          disableCooling,
          disableCoolingError: null,
          autoDisable429Threshold: String(autoDisable429Threshold),
          auto429RecheckInterval: String(auto429RecheckInterval),
          auto429Error: null,
          note,
          noteTouched: false,
          headersText,
          headersTouched: false,
          headersError,
          error: null,
        };
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.download_failed');
      setPrefixProxyEditor((prev) => {
        if (!prev || prev.fileName !== name) return prev;
        return { ...prev, loading: false, error: errorMessage, rawText: '' };
      });
      showNotification(`${t('notification.download_failed')}: ${errorMessage}`, 'error');
    }
  };

  const handlePrefixProxyChange = (
    field: PrefixProxyEditorField,
    value: PrefixProxyEditorFieldValue
  ) => {
    setPrefixProxyEditor((prev) => {
      if (!prev) return prev;
      if (field === 'prefix') return { ...prev, prefix: String(value) };
      if (field === 'proxyUrl') return { ...prev, proxyUrl: String(value) };
      if (field === 'priority') return { ...prev, priority: String(value) };
      if (field === 'disableCooling') {
        const nextValue = String(value);
        return {
          ...prev,
          disableCooling: nextValue,
          disableCoolingError: validateDisableCoolingInput(nextValue, (key) => t(key)),
        };
      }
      if (field === 'autoDisable429Threshold') {
        const nextValue = String(value);
        return {
          ...prev,
          autoDisable429Threshold: nextValue,
          auto429Error:
            validateIntegerInput(nextValue, (key) => t(key)) ??
            validateIntegerInput(prev.auto429RecheckInterval, (key) => t(key)),
        };
      }
      if (field === 'auto429RecheckInterval') {
        const nextValue = String(value);
        return {
          ...prev,
          auto429RecheckInterval: nextValue,
          auto429Error:
            validateIntegerInput(prev.autoDisable429Threshold, (key) => t(key)) ??
            validateIntegerInput(nextValue, (key) => t(key)),
        };
      }
      if (field === 'note') return { ...prev, note: String(value), noteTouched: true };
      if (field === 'headersText') {
        const headersText = String(value);
        const { errorKey } = parseHeadersText(headersText);
        return {
          ...prev,
          headersText,
          headersTouched: true,
          headersError: errorKey ? t(errorKey) : null,
        };
      }
      return prev;
    });
  };

  const handlePrefixProxySave = async () => {
    if (!prefixProxyEditor?.json) return;
    if (!prefixProxyDirty) return;

    const name = prefixProxyEditor.fileName;
    let payload: AuthFileFieldsPatch;
    try {
      payload = buildAuthFileFieldsPatch(prefixProxyEditor, (key) => t(key));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid format';
      showNotification(errorMessage, 'error');
      return;
    }
    if (!hasKeys(payload)) return;

    setPrefixProxyEditor((prev) => {
      if (!prev || prev.fileName !== name) return prev;
      return { ...prev, saving: true };
    });

    try {
      await authFilesApi.patchFields(name, payload);
      showNotification(t('auth_files.prefix_proxy_saved_success', { name }), 'success');
      await loadFiles();
      setPrefixProxyEditor(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '';
      showNotification(`${t('notification.update_failed')}: ${errorMessage}`, 'error');
      setPrefixProxyEditor((prev) => {
        if (!prev || prev.fileName !== name) return prev;
        return { ...prev, saving: false };
      });
    }
  };

  return {
    prefixProxyEditor,
    prefixProxyUpdatedText,
    prefixProxyDirty,
    openPrefixProxyEditor,
    closePrefixProxyEditor,
    handlePrefixProxyChange,
    handlePrefixProxySave,
  };
}
