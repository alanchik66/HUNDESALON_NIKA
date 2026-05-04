const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const locales = ['de', 'en', 'ru', 'uk'];
const fontStylesheet = 'https://fonts.googleapis.com/css2?family=Grenze+Gotisch:wght@400;700&family=Old+Standard+TT:wght@400;700&display=swap';
const styleHref = '../assets/css/style.css?v=20260420-10';
const iconHref = '../assets/fonts/fontawesome/all.min.css?v=20260329-0192';
const pageModulesHref = '../assets/css/page-modules.css?v=20260411-01';

function walkHtmlFiles(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            files.push(...walkHtmlFiles(entryPath));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.html')) {
            files.push(entryPath);
        }
    }

    return files;
}

function getOptimizedHeadBlock(indentation) {
    return [
        `${indentation}<link rel="icon" type="image/png" href="../assets/images/favicon.png">`,
        `${indentation}<link rel="preconnect" href="https://fonts.googleapis.com">`,
        `${indentation}<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
        `${indentation}<link rel="preload" href="${styleHref}" as="style">`,
        `${indentation}<link rel="stylesheet" href="${styleHref}">`,
        `${indentation}<link rel="preload" href="${fontStylesheet}" as="style">`,
        `${indentation}<link rel="stylesheet" href="${fontStylesheet}" media="print" onload="this.media='all'">`,
        `${indentation}<link rel="preload" href="${iconHref}" as="style">`,
        `${indentation}<link rel="stylesheet" href="${iconHref}" media="print" onload="this.media='all'">`,
        `${indentation}<link rel="preload" href="${pageModulesHref}" as="style">`,
        `${indentation}<link rel="stylesheet" href="${pageModulesHref}" media="print" onload="this.media='all'">`,
        `${indentation}<noscript>`,
        `${indentation}  <link rel="stylesheet" href="${fontStylesheet}">`,
        `${indentation}  <link rel="stylesheet" href="${iconHref}">`,
        `${indentation}  <link rel="stylesheet" href="${pageModulesHref}">`,
        `${indentation}</noscript>`
    ].join('\n');
}

let updatedCount = 0;

for (const locale of locales) {
    const localeDir = path.join(workspaceRoot, locale);

    for (const filePath of walkHtmlFiles(localeDir)) {
        const source = fs.readFileSync(filePath, 'utf8');
        const match = source.match(/^(\s*)<link rel="icon" type="image\/png" href="\.\.\/assets\/images\/favicon\.png"\s*\/?>\r?\n\1<link rel="stylesheet" href="\.\.\/assets\/css\/style\.css\?v=20260420-10"\s*\/?>\r?\n\1<link rel="stylesheet" href="\.\.\/assets\/fonts\/fontawesome\/all\.min\.css\?v=20260329-0192"\s*\/?>\r?\n\1<link rel="stylesheet" href="\.\.\/assets\/css\/page-modules\.css\?v=20260411-01"\s*\/?>/m);

        if (!match) {
            continue;
        }

        const replacement = getOptimizedHeadBlock(match[1]);
        const updated = source.replace(match[0], replacement);

        if (updated !== source) {
            fs.writeFileSync(filePath, updated, 'utf8');
            updatedCount += 1;
            console.log(path.relative(workspaceRoot, filePath));
        }
    }
}

console.log(`Updated ${updatedCount} files.`);