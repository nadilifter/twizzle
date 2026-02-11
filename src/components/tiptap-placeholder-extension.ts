import { Node, mergeAttributes } from "@tiptap/react"

/**
 * PlaceholderChip - Custom Tiptap Node Extension
 *
 * Renders template placeholders as styled inline chips in the editor.
 * - Displays the human-readable label (e.g., "Athlete Name")
 * - Stores the key (e.g., "athleteName") as a node attribute
 * - Serializes to {{key}} in HTML output for backend rendering
 * - Parses {{key}} patterns back into chip nodes when loading content
 */

export interface PlaceholderChipOptions {
  HTMLAttributes: Record<string, any>
  /** Map of placeholder keys to their display labels */
  labelMap: Record<string, string>
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    placeholderChip: {
      /**
       * Insert a placeholder chip at the current cursor position
       */
      insertPlaceholder: (key: string) => ReturnType
    }
  }
}

export const PlaceholderChip = Node.create<PlaceholderChipOptions>({
  name: "placeholderChip",

  addOptions() {
    return {
      HTMLAttributes: {},
      labelMap: {},
    }
  },

  group: "inline",

  inline: true,

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-placeholder-key"),
        renderHTML: (attributes) => {
          if (!attributes.key) return {}
          return { "data-placeholder-key": attributes.key }
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-placeholder-label"),
        renderHTML: (attributes) => {
          if (!attributes.label) return {}
          return { "data-placeholder-label": attributes.label }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-placeholder-key]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const key = node.attrs.key
    const label = node.attrs.label || this.options.labelMap[key] || key

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-placeholder-key": key,
        "data-placeholder-label": label,
        class: "placeholder-chip",
        contenteditable: "false",
        style:
          "display: inline-flex; align-items: center; gap: 2px; padding: 1px 8px; margin: 0 1px; border-radius: 9999px; background-color: #dbeafe; color: #1e40af; font-size: 0.8125rem; font-weight: 500; line-height: 1.5; white-space: nowrap; border: 1px solid #93c5fd; vertical-align: baseline; cursor: default; user-select: all;",
      }),
      label,
    ]
  },

  renderText({ node }) {
    // When copying as plain text, output the {{key}} format
    return `{{${node.attrs.key}}}`
  },

  addCommands() {
    return {
      insertPlaceholder:
        (key: string) =>
        ({ commands, editor }) => {
          const label = this.options.labelMap[key] || key
          return commands.insertContent({
            type: this.name,
            attrs: { key, label },
          })
        },
    }
  },
})

/**
 * Converts the Tiptap HTML output to a backend-friendly format:
 * Replaces <span data-placeholder-key="...">...</span> with {{key}}
 */
export function serializePlaceholders(html: string): string {
  return html.replace(
    /<span[^>]*data-placeholder-key="([^"]+)"[^>]*>[^<]*<\/span>/g,
    "{{$1}}"
  )
}

/**
 * Converts backend {{key}} placeholders to Tiptap-compatible HTML spans
 * for loading saved campaign content into the editor.
 */
export function deserializePlaceholders(
  html: string,
  labelMap: Record<string, string>
): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const label = labelMap[key] || key
    return `<span data-placeholder-key="${key}" data-placeholder-label="${label}" class="placeholder-chip" contenteditable="false" style="display: inline-flex; align-items: center; gap: 2px; padding: 1px 8px; margin: 0 1px; border-radius: 9999px; background-color: #dbeafe; color: #1e40af; font-size: 0.8125rem; font-weight: 500; line-height: 1.5; white-space: nowrap; border: 1px solid #93c5fd; vertical-align: baseline; cursor: default; user-select: all;">${label}</span>`
  })
}
