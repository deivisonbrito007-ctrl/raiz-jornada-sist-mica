import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, List, ListOrdered, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  valor: string;
  onChange: (html: string) => void;
  rotuloId: string;
};

const botao =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-papel text-floresta transition-colors hover:bg-ouro/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota";

/** Editor de texto formatado para práticas de texto, exercício e tarefa. */
export function EditorTexto({ valor, onChange, rotuloId }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: valor || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": rotuloId,
        class:
          "min-h-40 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota",
      },
    },
    onUpdate: ({ editor: instancia }) => onChange(instancia.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (valor !== editor.getHTML()) editor.commands.setContent(valor || "");
    // Só sincroniza quando o conteúdo vem de fora (abrir outra prática).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, rotuloId]);

  if (!editor) return null;

  const acoes = [
    {
      chave: "bold",
      rotulo: "Negrito",
      Icone: Bold,
      ativo: editor.isActive("bold"),
      acao: () => editor.chain().focus().toggleBold().run(),
    },
    {
      chave: "italic",
      rotulo: "Itálico",
      Icone: Italic,
      ativo: editor.isActive("italic"),
      acao: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      chave: "heading",
      rotulo: "Subtítulo",
      Icone: Heading2,
      ativo: editor.isActive("heading", { level: 2 }),
      acao: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      chave: "bulletList",
      rotulo: "Lista com marcadores",
      Icone: List,
      ativo: editor.isActive("bulletList"),
      acao: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      chave: "orderedList",
      rotulo: "Lista numerada",
      Icone: ListOrdered,
      ativo: editor.isActive("orderedList"),
      acao: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      chave: "blockquote",
      rotulo: "Citação",
      Icone: Quote,
      ativo: editor.isActive("blockquote"),
      acao: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="editor-rico">
      <div className="mb-2 flex flex-wrap gap-1.5" role="toolbar" aria-label="Formatação do texto">
        {acoes.map(({ chave, rotulo, Icone, ativo, acao }) => (
          <button
            key={chave}
            type="button"
            onClick={acao}
            aria-label={rotulo}
            aria-pressed={ativo}
            className={cn(botao, ativo && "border-terracota bg-ouro/25")}
          >
            <Icone className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
