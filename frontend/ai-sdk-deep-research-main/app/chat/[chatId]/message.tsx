import { ResearchUpdateAnnotations } from '@/components/message-annotations';
import { ChatMessage } from '@/lib/ai/types';
import { Artifact } from '@/components/artifact';
import { Message as AIMessage, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';

export default function Message({ message }: { message: ChatMessage }) {
  const date = message.metadata?.createdAt
    ? new Date(message.metadata.createdAt).toLocaleString()
    : '';

  return (
    <div className="my-2">
      <AIMessage from={message.role} className="w-full">
        <MessageContent className="group-[.is-assistant]:w-full ">
          {date ? (
            <div className="mb-1 text-xs text-gray-500">{date}</div>
          ) : null}

          <ResearchUpdateAnnotations
            parts={message.parts}
            key={`research-update-annotations-${message.id}`}
          />

          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return (
                <Response key={`${message.id}-${i}`}>{part.text}</Response>
              );
            }
            return null;
          })}
        </MessageContent>
      </AIMessage>

      {/* Display artifact if present */}
      <Artifact parts={message.parts} />
    </div>
  );
}
