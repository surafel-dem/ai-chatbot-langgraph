export const emit = (ui: any) => ({
  textDelta: (text: string) => ui.write({ type: 'data-textDelta', data: text }),
  toolStart: (name: string, input: unknown) =>
    ui.write({ type: 'data-part', data: { type: 'tool-input-available', toolName: name, toolInput: input }, transient: true }),
  toolResult: (name: string, output: unknown) =>
    ui.write({ type: 'data-part', data: { type: 'tool-output-available', toolName: name, toolResult: output }, transient: true }),
  sourceUrl: (url: string, title?: string) =>
    ui.write({ type: 'data-part', data: { type: 'source-url', url, title }, transient: true }),
  plannerState: (selectedCar: any) =>
    ui.write({ type: 'data-part', data: { type: 'planner-state', selectedCar }, transient: true }),
  finishStep: () => ui.write({ type: 'data-part', data: { type: 'finish-step' }, transient: true }),
  status: (text: string, level?: 'info' | 'warn' | 'error') =>
    ui.write({ type: 'data-part', data: { type: 'status', text, level }, transient: true }),
});


