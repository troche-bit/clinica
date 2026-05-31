import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExt from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { useEffect, useRef } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Image as ImageIcon,
} from 'lucide-react'

function ToolBtn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`wysiwyg-tb-btn${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function WysiwygEditor({
  value,
  onChange,
  onImageUpload,
  onImageError,
  editorRef,
  uploadPending,
}) {
  const fileRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editorRef) editorRef.current = editor
  }, [editor, editorRef])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !onImageUpload) return
    e.target.value = ''
    try {
      const { url } = await onImageUpload(file)
      editor?.chain().focus().setImage({ src: url }).run()
    } catch (err) {
      onImageError?.(err)
    }
  }

  return (
    <>
      <style>{`
        .wysiwyg-wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .wysiwyg-wrap:focus-within { border-color: #1a3a5c; }

        .wysiwyg-toolbar {
          display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
          background: #f3f4f6; border-bottom: 1px solid #e5e7eb; padding: 5px 8px;
        }
        .wysiwyg-tb-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 5px; border: none;
          background: transparent; color: #374151; cursor: pointer;
          transition: background .12s; flex-shrink: 0;
        }
        .wysiwyg-tb-btn:hover:not(:disabled) { background: #e5e7eb; }
        .wysiwyg-tb-btn.is-active { background: #dbeafe; color: #1a3a5c; }
        .wysiwyg-tb-btn:disabled { opacity: .5; cursor: default; }
        .wysiwyg-tb-sep { width: 1px; height: 18px; background: #d1d5db; margin: 0 3px; flex-shrink: 0; }

        .wysiwyg-body { background: #fff; }
        .wysiwyg-body .tiptap {
          min-height: 150px; padding: 12px; outline: none;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          color: #111827; line-height: 1.7;
        }
        .wysiwyg-body .tiptap p { margin: 0 0 6px; }
        .wysiwyg-body .tiptap p:last-child { margin-bottom: 0; }
        .wysiwyg-body .tiptap ul,
        .wysiwyg-body .tiptap ol { padding-left: 20px; margin: 0 0 6px; }
        .wysiwyg-body .tiptap li p { margin: 0; }
        .wysiwyg-body .tiptap img {
          max-width: 100%; border-radius: 4px; display: block; margin: 6px 0;
          cursor: pointer; outline: 2px solid transparent; transition: outline-color .15s;
        }
        .wysiwyg-body .tiptap img.ProseMirror-selectednode { outline-color: #1a3a5c; }
        .wysiwyg-body .tiptap strong { font-weight: 600; }
        .wysiwyg-body .tiptap em { font-style: italic; }
        .wysiwyg-body .tiptap u { text-decoration: underline; }
      `}</style>

      <div className="wysiwyg-wrap">
        <div className="wysiwyg-toolbar">
          <ToolBtn title="Negrita" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold size={14} />
          </ToolBtn>
          <ToolBtn title="Cursiva" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic size={14} />
          </ToolBtn>
          <ToolBtn title="Subrayado" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={14} />
          </ToolBtn>

          <div className="wysiwyg-tb-sep" />

          <ToolBtn title="Alinear izquierda" active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
            <AlignLeft size={14} />
          </ToolBtn>
          <ToolBtn title="Centrar" active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
            <AlignCenter size={14} />
          </ToolBtn>
          <ToolBtn title="Alinear derecha" active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
            <AlignRight size={14} />
          </ToolBtn>

          <div className="wysiwyg-tb-sep" />

          <ToolBtn title="Lista con viñetas" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List size={14} />
          </ToolBtn>
          <ToolBtn title="Lista numerada" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={14} />
          </ToolBtn>

          <div className="wysiwyg-tb-sep" />

          <ToolBtn title={uploadPending ? 'Subiendo imagen…' : 'Insertar imagen'} disabled={uploadPending} onClick={() => fileRef.current?.click()}>
            <ImageIcon size={14} />
          </ToolBtn>
        </div>

        <div className="wysiwyg-body">
          <EditorContent editor={editor} />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>
    </>
  )
}
