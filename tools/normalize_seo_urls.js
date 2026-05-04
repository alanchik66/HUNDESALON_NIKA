const fs = import fs from 'fs';
const path = import path from 'path';

const siteRoot = 'https://hundesalon-nika.com';
const languages = ['de', 'ru', 'uk', 'en'];
const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).substring(1), '..');

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

function getLocalizedUrl(language, relativePath) {
    if (relativePath === 'index.html') {
        return `${siteRoot}/${language}/`;
    }

    return `${siteRoot}/${language}/${relativePath.replace(/\\/g, '/')}`;
}

function replaceSingle(source, pattern, replacement) {
    if (!pattern.test(source)) {
        return source;
    }

    pattern.lastIndex = 0;
    return source.replace(pattern, replacement);
}

let updatedFiles = 0;

for (const language of languages) {
    const languageDir = path.join(workspaceRoot, language);
    const htmlFiles = walkHtmlFiles(languageDir);

    for (const filePath of htmlFiles) {
        const relativePath = path.relative(languageDir, filePath).replace(/\\/g, '/');
        const canonicalUrl = getLocalizedUrl(language, relativePath);
        const xDefaultUrl = getLocalizedUrl('en', relativePath);
        let content = fs.readFileSync(filePath, 'utf8');
        const original = content;

        content = replaceSingle(
            content,
            /<link rel="canonical" href="[^"]*"\s*\/?>(?:\r?\n)?/,
            `<link rel="canonical" href="${canonicalUrl}">\n`
        );

        for (const hreflang of languages) {
            const hreflangUrl = getLocalizedUrl(hreflang, relativePath);
            const hreflangPattern = new RegExp(
                `<link rel="alternate" hreflang="${hreflang}" href="[^"]*"\\s*\\/?>`,
                'g'
            );
            content = content.replace(
                hreflangPattern,
                `<link rel="alternate" hreflang="${hreflang}" href="${hreflangUrl}">`
            );
        }

        content = content.replace(
            /<link rel="alternate" hreflang="x-default" href="[^"]*"\s*\/?>(?:\r?\n)?/g,
            `<link rel="alternate" hreflang="x-default" href="${xDefaultUrl}">\n`
        );

        content = replaceSingle(
            content,
            /<meta property="og:url" content="[^"]*"\s*\/?>(?:\r?\n)?/,
            `<meta property="og:url" content="${canonicalUrl}">\n`
        );

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            updatedFiles += 1;
            console.log(path.relative(workspaceRoot, filePath));
        }
    }
}

console.log(`Updated ${updatedFiles} files.`);
