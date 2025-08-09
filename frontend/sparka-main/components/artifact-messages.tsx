import equal from 'fast-deep-equal';
import type { UIArtifact } from './artifact';
import { Messages, type MessagesProps } from './messages';
import { memo } from 'react';

export interface ArtifactMessagesProps extends MessagesProps {
  artifactStatus: UIArtifact['status'];
}

function PureArtifactMessages({
  artifactStatus,
  ...rest
}: ArtifactMessagesProps) {
  return <Messages {...rest} />;
}

function areEqual(
  prevProps: ArtifactMessagesProps,
  nextProps: ArtifactMessagesProps,
) {
  if (
    prevProps.artifactStatus === 'streaming' &&
    nextProps.artifactStatus === 'streaming'
  )
    return true;

  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.artifactStatus !== nextProps.artifactStatus) return false;
  if (prevProps.isReadonly !== nextProps.isReadonly) return false;
  if (prevProps.sendMessage !== nextProps.sendMessage) return false;
  if (prevProps.regenerate !== nextProps.regenerate) return false;

  return true;
}

export const ArtifactMessages = memo(PureArtifactMessages, areEqual);
