import { useState } from 'react';

export default function ChatInput({
  status,
  onSubmit,
  inputRef,
}: {
  status: string;
  onSubmit: (text: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const [text, setText] = useState('');

  return (
    <form
      className="w-full max-w-md mx-auto"
      onSubmit={e => {
        e.preventDefault();
        if (text.trim() === '') return;
        onSubmit(text);
        setText('');
      }}
    >
      <input
        ref={inputRef}
        className="fixed bottom-0 w-full max-w-md mx-auto p-2 mb-8 border border-gray-300 rounded shadow-xl"
        placeholder="Say something..."
        disabled={status !== 'ready'}
        value={text}
        onChange={e => setText(e.target.value)}
      />
    </form>
  );
}
