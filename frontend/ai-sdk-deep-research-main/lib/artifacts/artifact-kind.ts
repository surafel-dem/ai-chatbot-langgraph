export const artifactKinds = ['text'] as const;
export type ArtifactKind = (typeof artifactKinds)[number];
