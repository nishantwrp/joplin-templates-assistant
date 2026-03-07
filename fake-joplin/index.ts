/* eslint-disable @typescript-eslint/no-explicit-any */

import type Joplin from '../joplin-plugin-api/Joplin';
import type JoplinData from '../joplin-plugin-api/JoplinData';
import type JoplinSettings from '../joplin-plugin-api/JoplinSettings';
import type JoplinCommands from '../joplin-plugin-api/JoplinCommands';
import type JoplinViews from '../joplin-plugin-api/JoplinViews';
import type JoplinViewsDialogs from '../joplin-plugin-api/JoplinViewsDialogs';
import type JoplinViewsPanels from '../joplin-plugin-api/JoplinViewsPanels';
import type JoplinViewsEditors from '../joplin-plugin-api/JoplinViewsEditor';
import type JoplinViewsNoteList from '../joplin-plugin-api/JoplinViewsNoteList';
import type JoplinWorkspace from '../joplin-plugin-api/JoplinWorkspace';
import type JoplinPlugins from '../joplin-plugin-api/JoplinPlugins';
import type JoplinFilters from '../joplin-plugin-api/JoplinFilters';
import type JoplinInterop from '../joplin-plugin-api/JoplinInterop';
import type JoplinClipboard from '../joplin-plugin-api/JoplinClipboard';
import type JoplinWindow from '../joplin-plugin-api/JoplinWindow';
import type JoplinImaging from '../joplin-plugin-api/JoplinImaging';
import type JoplinContentScripts from '../joplin-plugin-api/JoplinContentScripts';
import {
  Command,
  Path,
  SettingItem,
  SettingSection,
  ButtonSpec,
  DialogResult,
  Toast,
  VersionInfo,
  ModelType,
  Disposable,
} from '../joplin-plugin-api/types';

interface Note {
  folderId: string;
  title: string;
  body: string;
  todo_due?: number;
  tags: string[];
};

let createNewNoteHandler: () => Promise<void>;
let currentTemplateContent: string = "";
let bufferedNote: Note | null = null;
let errorMessage: string = "";

// Storage for dialog HTML content
const dialogContents: Record<string, string> = {};
let dialogCallback: (html: string) => Promise<DialogResult> = async () => ({ id: 'cancel' });

const createNoteWithTemplate = (content: string, onDialogRequest: (html: string) => Promise<DialogResult>): Promise<Note | null> => {
  bufferedNote = null;
  errorMessage = "";
  currentTemplateContent = content;
  dialogCallback = onDialogRequest;

  return createNewNoteHandler().then(() => {
    console.info("fake-joplin: created note with template", bufferedNote);
    if (!bufferedNote) {
      if (errorMessage.length > 0) {
        console.info("fake-joplin: template parsing likely hit an error.");
        throw new Error(errorMessage);
      }
    }
    return bufferedNote;
  }, (error) => {
    console.error("fake-joplin: failed to create note with template", error);
    throw error;
  });
};

class FakeJoplinData implements Partial<JoplinData> {
  async get(_path: Path, _query?: any): Promise<any> {
    if (_path[0] === "search" && _query?.query === "template" && _query?.type === "tag") {
      return { items: [{ id: "template", name: "template" }], hasMore: false };
    }
    if (_path[0] === "search" && _query?.type === "tag") {
      return { items: [{ id: _query?.query ?? "", name: _query?.query ?? "" }], hasMore: false };
    }
    if (_path[0] === "tags" && _path[1] === "template" && _path[2] === "notes") {
      return { items: [{ id: "template", title: "Template Title", body: currentTemplateContent }], hasMore: false };
    }
    return {};
  }
  async post(_path: Path, _query?: any, _body?: any, _files?: any[]): Promise<any> {
    if (_path[0] === "notes") {
      bufferedNote = { folderId: _body?.parent_id, title: _body?.title, body: _body?.body, tags: [] };
      if (!!_body?.todo_due) bufferedNote.todo_due = _body?.todo_due;
      return { id: "new-note-id" };
    }
    if (_path[0] === "tags" && _path[2] === "notes") {
      if (!bufferedNote) throw new Error("No buffered note found.");
      bufferedNote.tags.push(_path[1] ?? "");
      return { id: _path[1] };
    }
    return {};
  }
  async put(_path: Path, _query?: any, _body?: any, _files?: any[]): Promise<any> {
    if (_path[0] === "notes" && _path[1] === "new-note-id") {
      if (!bufferedNote) throw new Error("No buffered note found.");
      bufferedNote.folderId = _body?.parent_id ?? bufferedNote.folderId;
      bufferedNote.title = _body?.title ?? bufferedNote.title;
      bufferedNote.body = _body?.body ?? bufferedNote.body;
      bufferedNote.todo_due = _body?.todo_due ?? bufferedNote.todo_due;
      return { id: "new-note-id" };
    }
    return {};
  }
  async delete(_path: Path, _query?: any): Promise<any> { return {}; }
  async itemType(_itemId: string): Promise<ModelType> { return ModelType.Note; }
  async resourcePath(_resourceId: string): Promise<string> { return ''; }
  async userDataGet<T>(_itemType: ModelType, _itemId: string, _key: string): Promise<T> { return {} as T; }
  async userDataSet<T>(_itemType: ModelType, _itemId: string, _key: string, _value: T): Promise<void> { }
  async userDataDelete(_itemType: ModelType, _itemId: string, _key: string): Promise<void> { }
}

class FakeJoplinSettings implements Partial<JoplinSettings> {
  async registerSettings(_settings: Record<string, SettingItem>): Promise<void> { }
  async registerSetting(_key: string, _setting: SettingItem): Promise<void> { }
  async registerSection(_name: string, _section: SettingSection): Promise<void> { }
  async value(_key: string): Promise<any> {
    if (_key == "templatesSource") return "tag";
    return null;
  }
  async values(_keys: string[] | string): Promise<Record<string, any>> { return {}; }
  async setValue(_key: string, _value: any): Promise<void> { }
  async globalValue(_key: string): Promise<any> {
    if (_key === "locale") return "en-US";
    if (_key === "dateFormat") return "YYYY-MM-DD";
    if (_key === "timeFormat") return "HH:mm";
    return null;
  }
  async globalValues(_keys: string[]): Promise<any[]> { return []; }
  async onChange(_handler: (event: any) => void): Promise<void> { }
}

class FakeJoplinCommands implements Partial<JoplinCommands> {
  async register(_command: Command): Promise<void> {
    if (_command.name === "createTodoFromTemplate") {
      createNewNoteHandler = _command.execute;
    }
  }
  async execute(_name: string, ..._args: any[]): Promise<any> { return null; }
}

class FakeJoplinViewsDialogs implements Partial<JoplinViewsDialogs> {
  async create(_id: string): Promise<string> { return _id; }
  async setHtml(_handle: string, _html: string): Promise<string> {
    dialogContents[_handle] = _html;
    return '';
  }
  async addScript(_handle: string, _script: string): Promise<void> { }
  async open(_handle: string): Promise<DialogResult> {
    if (_handle === "templateSelector") {
      return {
        id: 'ok',
        formData: {
          "templates-form": {
            template: JSON.stringify({
              id: "template",
              title: "Template Title",
              body: currentTemplateContent,
            })
          }
        }
      };
    }

    // For variable selector, use the HTML set via setHtml
    const html = dialogContents[_handle] || "";
    return dialogCallback(html);
  }
  async setButtons(_handle: string, _buttons: ButtonSpec[]): Promise<ButtonSpec[]> { return []; }
  async showMessageBox(_message: string): Promise<number> {
    errorMessage = _message;
    return 0;
  }
  async showToast(_toast: Toast): Promise<void> { }
  async showOpenDialog(_options: any): Promise<any> { return null; }
  async setFitToContent(_handle: string, _status: boolean): Promise<boolean> { return true; }
}

class FakeJoplinViewsPanels implements Partial<JoplinViewsPanels> {
  async create(_id: string): Promise<string> { return _id; }
  async setHtml(_handle: string, _html: string): Promise<string> { return ''; }
  async addScript(_handle: string, _script: string): Promise<void> { }
  async show(_handle: string, _show: boolean = true): Promise<void> { }
  async onMessage(_handle: string, _callback: Function): Promise<void> { }
  async postMessage(_handle: string, _message: any): Promise<void> { }
  async hide(_handle: string): Promise<void> { }
  async visible(_handle: string): Promise<boolean> { return true; }
  async isActive(_handle: string): Promise<boolean> { return true; }
}

class FakeJoplinViews implements Partial<JoplinViews> {
  private dialogs_ = new FakeJoplinViewsDialogs() as unknown as JoplinViewsDialogs;
  private panels_ = new FakeJoplinViewsPanels() as unknown as JoplinViewsPanels;
  private editors_ = {} as any;
  private noteList_ = {} as any;

  get dialogs() { return this.dialogs_; }
  get panels() { return this.panels_; }
  get editors() { return this.editors_; }
  get noteList() { return this.noteList_; }
  get menuItems() {
    return { create: async () => { } } as any;
  }
  get menus() {
    return { create: async () => { } } as any;
  }
  get toolbarButtons() {
    return { create: async () => { } } as any;
  }
}

class FakeJoplinWorkspace implements Partial<JoplinWorkspace> {
  async onNoteSelectionChange(_callback: any): Promise<Disposable> { return {}; }
  async onNoteChange(_callback: any): Promise<Disposable> { return {}; }
  async onSyncComplete(_callback: any): Promise<Disposable> { return {}; }
  async onNoteContentChange(_callback: any): Promise<void> { }
  async onResourceChange(_callback: any): Promise<void> { }
  async onNoteAlarmTrigger(_callback: any): Promise<Disposable> { return {}; }
  async onSyncStart(_callback: any): Promise<Disposable> { return {}; }
  async selectedNote(): Promise<any> { return null; }
  async selectedFolder(): Promise<any> { return { id: "current-notebook-id" }; }
  async selectedNoteIds(): Promise<string[]> { return []; }
  async selectedNoteHash(): Promise<string> { return ''; }
  filterEditorContextMenu(_handler: any): void { }
}

class FakeJoplinPlugins implements Partial<JoplinPlugins> {
  async register(plugin: any): Promise<void> {
    if (plugin.onStart) await plugin.onStart();
  }
  async registerContentScript(_type: string, _id: string, _scriptPath: string): Promise<void> { }
  async dataDir(): Promise<string> { return ''; }
  async installationDir(): Promise<string> { return ''; }
}

class FakeJoplinFilters implements Partial<JoplinFilters> {
  async on(_name: string, _callback: any): Promise<void> { }
  async off(_name: string, _callback: any): Promise<void> { }
}

class FakeJoplinInterop implements Partial<JoplinInterop> {
  async registerImportModule(_module: any): Promise<void> { }
  async registerExportModule(_module: any): Promise<void> { }
}

class FakeJoplinClipboard implements Partial<JoplinClipboard> {
  async readText(): Promise<string> { return ''; }
  async writeText(_text: string): Promise<void> { }
  async readHtml(): Promise<string> { return ''; }
  async writeHtml(_html: string): Promise<void> { }
}

class FakeJoplinWindow implements Partial<JoplinWindow> {
  async loadChromeCssFile(_path: string): Promise<void> { }
  async loadNoteCssFile(_path: string): Promise<void> { }
}

class FakeJoplinImaging implements Partial<JoplinImaging> {
  async createFromPath(_path: string): Promise<any> { return {}; }
  async resize(_handle: any, _options: any): Promise<any> { return {}; }
}

class FakeJoplinContentScripts implements Partial<JoplinContentScripts> {
  async register(_type: string, _id: string, _scriptPath: string): Promise<void> { }
  async onMessage(_id: string, _callback: Function): Promise<void> { }
}

class FakeJoplin implements Partial<Joplin> {
  private data_ = new FakeJoplinData() as unknown as JoplinData;
  private settings_ = new FakeJoplinSettings() as unknown as JoplinSettings;
  private commands_ = new FakeJoplinCommands() as unknown as JoplinCommands;
  private views_ = new FakeJoplinViews() as unknown as JoplinViews;
  private workspace_ = new FakeJoplinWorkspace() as unknown as JoplinWorkspace;
  private plugins_ = new FakeJoplinPlugins() as unknown as JoplinPlugins;
  private filters_ = new FakeJoplinFilters() as unknown as JoplinFilters;
  private interop_ = new FakeJoplinInterop() as unknown as JoplinInterop;
  private clipboard_ = new FakeJoplinClipboard() as unknown as JoplinClipboard;
  private window_ = new FakeJoplinWindow() as unknown as JoplinWindow;
  private imaging_ = new FakeJoplinImaging() as unknown as JoplinImaging;
  private contentScripts_ = new FakeJoplinContentScripts() as unknown as JoplinContentScripts;

  get data() { return this.data_; }
  get settings() { return this.settings_; }
  get commands() { return this.commands_; }
  get views() { return this.views_; }
  get workspace() { return this.workspace_; }
  get plugins() { return this.plugins_; }
  get filters() { return this.filters_; }
  get interop() { return this.interop_; }
  get clipboard() { return this.clipboard_; }
  get window() { return this.window_; }
  get imaging() { return this.imaging_; }
  get contentScripts() { return this.contentScripts_; }

  async versionInfo(): Promise<VersionInfo> { return { version: '1.0.0', platform: 'desktop', profileVersion: 1, syncVersion: 1 }; }
  async shouldUseDarkColors(): Promise<boolean> { return false; }
  require(_path: string): any {
    if (_path === 'buffer') return require('buffer');
    if (_path === 'fs-extra') return { pathExists: async () => false };
    return null;
  }
}

const joplin = new FakeJoplin() as unknown as Joplin;
export { joplin, createNoteWithTemplate };
