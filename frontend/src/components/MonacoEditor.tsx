import React, { useRef, useEffect } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { updateFileContent } from '../store/slices/projectSlice';

interface MonacoEditorProps {
  filename: string;
  content: string;
  language: string;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ filename, content, language }) => {
  const dispatch = useAppDispatch();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      lineNumbers: 'on',
      minimap: { enabled: true },
      folding: true,
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Save file (handled by parent component)
      console.log('Save shortcut triggered');
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find').run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.startFindReplaceAction').run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.getAction('editor.action.addSelectionToNextFindMatch').run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.getAction('editor.action.commentLine').run();
    });

    // Format document
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI, () => {
      editor.getAction('editor.action.formatDocument').run();
    });

    // Configure language-specific settings
    if (language === 'typescript' || language === 'javascript') {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types'],
      });

      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      dispatch(updateFileContent({ filename, content: value }));
    }
  };

  const getLanguageFromFilename = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="monaco-editor-container">
      <Editor
        height="100%"
        language={getLanguageFromFilename(filename)}
        value={content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          selectOnLineNumbers: true,
          roundedSelection: false,
          readOnly: false,
          cursorStyle: 'line',
          automaticLayout: true,
        }}
      />
    </div>
  );
};

export default MonacoEditor;