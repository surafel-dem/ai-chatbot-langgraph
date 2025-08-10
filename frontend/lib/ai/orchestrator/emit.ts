export const emit = (ui: any) => ({
  textDelta: (text: string) => ui.writeData({ type: 'text-delta', textDelta: text }),
  toolStart: (name: string, input: unknown) =>
    ui.writeData({ type: 'tool-input-available', toolName: name, toolInput: input }),
  toolResult: (name: string, output: unknown) =>
    ui.writeData({ type: 'tool-output-available', toolName: name, toolResult: output }),
  sourceUrl: (url: string, title?: string) => ui.writeData({ type: 'source-url', url, title }),
  finishStep: () => ui.writeData({ type: 'finish-step' }),
});

 