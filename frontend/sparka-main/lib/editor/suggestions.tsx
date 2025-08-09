import {
  $isTextNode,
  type LexicalNode,
  type NodeKey,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
} from 'lexical';
import { DecoratorNode, $getRoot } from 'lexical';

import { Suggestion as PreviewSuggestion } from '@/components/suggestion';
import type { Suggestion } from '@/lib/db/schema';
import type { ArtifactKind } from '@/lib/artifacts/artifact-kind';
import type { LexicalEditor } from 'lexical';

export interface UISuggestion extends Suggestion {
  selectionStart: number;
  selectionEnd: number;
}

interface Position {
  start: number;
  end: number;
}

function findPositionsInEditor(
  editor: LexicalEditor,
  searchText: string,
): Position | null {
  let positions: { start: number; end: number } | null = null;

  editor.getEditorState().read(() => {
    const root = $getRoot();
    let currentPos = 0;

    function traverse(node: LexicalNode) {
      if ($isTextNode(node) && node.getTextContent().includes(searchText)) {
        const text = node.getTextContent();
        const index = text.indexOf(searchText);

        if (index !== -1) {
          positions = {
            start: currentPos + index,
            end: currentPos + index + searchText.length,
          };
          return;
        }
      }

      if ($isTextNode(node)) {
        currentPos += node.getTextContent().length;
      }

      // Only element nodes have children
      if ($isElementNode(node)) {
        const children = node.getChildren();
        for (const child of children) {
          traverse(child);
          if (positions) return;
        }
      }
    }

    traverse(root);
  });

  return positions;
}

export function projectWithPositions(
  editor: LexicalEditor,
  suggestions: Array<Suggestion>,
): Array<UISuggestion> {
  return suggestions.map((suggestion) => {
    const positions = findPositionsInEditor(editor, suggestion.originalText);

    if (!positions) {
      return {
        ...suggestion,
        selectionStart: 0,
        selectionEnd: 0,
      };
    }

    return {
      ...suggestion,
      selectionStart: positions.start,
      selectionEnd: positions.end,
    };
  });
}

// Lexical Decorator Node for suggestions
export class SuggestionNode extends DecoratorNode<React.ReactElement> {
  __suggestion: UISuggestion;
  __editor: LexicalEditor;
  __artifactKind: ArtifactKind;

  static getType(): string {
    return 'suggestion';
  }

  static clone(node: SuggestionNode): SuggestionNode {
    return new SuggestionNode(
      node.__suggestion,
      node.__editor,
      node.__artifactKind,
      node.__key,
    );
  }

  constructor(
    suggestion: UISuggestion,
    editor: LexicalEditor,
    artifactKind: ArtifactKind = 'text',
    key?: NodeKey,
  ) {
    super(key);
    this.__suggestion = suggestion;
    this.__editor = editor;
    this.__artifactKind = artifactKind;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('span');
    dom.className = 'suggestion-highlight';
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): React.ReactElement {
    const onApply = () => {
      this.__editor.update(() => {
        // Find and replace the text
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = selection.anchor.getNode();
          if ($isTextNode(node)) {
            const textContent = node.getTextContent();
            const newText = textContent.replace(
              this.__suggestion.originalText,
              this.__suggestion.suggestedText,
            );
            node.setTextContent(newText);
          }
        }

        // Remove this suggestion node
        this.remove();
      });
    };

    return (
      <PreviewSuggestion
        suggestion={this.__suggestion}
        onApply={onApply}
        artifactKind={this.__artifactKind}
      />
    );
  }
}

export function createSuggestionDecorator(
  suggestion: UISuggestion,
  editor: LexicalEditor,
  artifactKind: ArtifactKind = 'text',
): SuggestionNode {
  return new SuggestionNode(suggestion, editor, artifactKind);
}

// Plugin-like function to register suggestions
export function registerSuggestions(
  editor: LexicalEditor,
  suggestions: Array<UISuggestion>,
): void {
  editor.update(() => {
    // Clear existing suggestion nodes
    const root = $getRoot();
    const children = root.getChildren();

    for (const child of children) {
      if (child instanceof SuggestionNode) {
        child.remove();
      }
    }

    // Add new suggestion nodes
    suggestions.forEach((suggestion) => {
      if (suggestion.selectionStart && suggestion.selectionEnd) {
        const suggestionNode = createSuggestionDecorator(suggestion, editor);
        // Insert at the end for now - proper positioning would need more work
        root.append(suggestionNode);
      }
    });
  });
}
