import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const srcEntry = 'packages/pentem-cli/src/index.ts';
const outFile = 'packages/pentem-cli/dist/sea-entry.cjs';

const patchBlessedPlugin = {
  name: 'patch-blessed',
  setup(build) {
    build.onResolve({ filter: /^(term\.js|pty\.js)$/ }, () => {
      return { path: 'term.js', external: true };
    });

    build.onLoad({ filter: /blessed[/\\]lib[/\\]widget\.js$/, namespace: 'file' }, async (args) => {
      let contents = readFileSync(args.path, 'utf8');

      const staticWidgetMap = `function loadWidget(name) {
  var file = name.toLowerCase();
  switch (file) {
    case 'node': return require("./widgets/node");
    case 'element': return require("./widgets/element");
    case 'screen': return require("./widgets/screen");
    case 'box': return require("./widgets/box");
    case 'line': return require("./widgets/line");
    case 'scrollablebox': return require("./widgets/scrollablebox");
    case 'scrollabletext': return require("./widgets/scrollabletext");
    case 'text': return require("./widgets/text");
    case 'button': return require("./widgets/button");
    case 'input': return require("./widgets/input");
    case 'textarea': return require("./widgets/textarea");
    case 'textbox': return require("./widgets/textbox");
    case 'checkbox': return require("./widgets/checkbox");
    case 'radiobutton': return require("./widgets/radiobutton");
    case 'radioset': return require("./widgets/radioset");
    case 'form': return require("./widgets/form");
    case 'table': return require("./widgets/table");
    case 'list': return require("./widgets/list");
    case 'listtable': return require("./widgets/listtable");
    case 'listbar': return require("./widgets/listbar");
    case 'progressbar': return require("./widgets/progressbar");
    case 'filemanager': return require("./widgets/filemanager");
    case 'terminal': return require("./widgets/terminal");
    case 'layout': return require("./widgets/layout");
    case 'log': return require("./widgets/log");
    case 'message': return require("./widgets/message");
    case 'question': return require("./widgets/question");
    case 'prompt': return require("./widgets/prompt");
    case 'loading': return require("./widgets/loading");
    case 'image': return require("./widgets/image");
    case 'ansiimage': return require("./widgets/ansiimage");
    case 'overlayimage': return require("./widgets/overlayimage");
    case 'video': return require("./widgets/video");
    case 'bigtext': return require("./widgets/bigtext");
    default: throw new Error('Unknown widget: ' + name);
  }
}
`;

      contents = contents.replace(
        /widget\.classes\.forEach\(function\s*\((\w+)\)\s*\{[^}]*require\([^)]+\)[^}]*\}\)/,
        `widget.classes.forEach(function($1) { var file = $1.toLowerCase(); widget[$1] = widget[file] = loadWidget($1); })`
      );

      if (!contents.includes('function loadWidget')) {
        contents = staticWidgetMap + '\n' + contents;
      }

      return { contents, loader: 'js' };
    });
  },
};

await esbuild.build({
  entryPoints: [srcEntry],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: outFile,
  external: ['node:*'],
  plugins: [patchBlessedPlugin],
  resolveExtensions: ['.ts', '.js', '.json'],
});

console.log(`Bundled to ${outFile}`);
