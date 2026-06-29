import { useMemo } from "react";
import ReactQuill from "react-quill-new";

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike", "blockquote"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

export default function RichTextEditor({ value, onChange, placeholder = "Begin your entry…" }) {
  const modules = useMemo(() => ({ toolbar: TOOLBAR }), []);
  return (
    <div data-testid="rich-text-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
      />
    </div>
  );
}
