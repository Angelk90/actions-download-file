const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

function getFilenameFromUrl(url) {
    const u = new URL(url);
    const pathname = u.pathname;
    const pathClips = pathname.split("/");
    const filenameWithArgs = pathClips[pathClips.length - 1];
    return filenameWithArgs.replace(/\?.*/, "");
}

const getLinksFromString = (text) => text.match(/https[^ '")]*/gi);

const getLinks = (data) => {
    switch (typeof data) {
        case 'string': {
            return getLinksFromString(data);
        }
        case 'object':
            const links = [];
            for (text of data) {
                links.push(...getLinksFromString(text));
            }
            return links;
    }
}

function parseName(urls) {
    let filename = [];
    if (!urls.includes("[")) filename = [urls].flat();
    else filename = JSON.parse(urls);
    return filename.filter((url) => url);
}

async function download(url, filename, target) {
    const body = await fetch(url)
        .then((x) => x.buffer())
        .catch((err) => {
            core.setFailed(`Fail to download file ${url}: ${err}`);
            return undefined;
        });
    if (body === undefined) return;
    let finalFilename = (filename) ? String(filename) : getFilenameFromUrl(url)
    if (finalFilename === "") {
        core.setFailed("Filename not found. Please indicate it in the URL or set `filename` in the workflow.");
        return;
    }
    fs.writeFileSync(path.join(target, finalFilename), body)
    core.setOutput("filename", finalFilename);
    return finalFilename;
}

async function main() {
    try {
        const text = core.getInput("url");
        const target = core.getInput("target");
        let filename = core.getInput("filename");
        const urls = getLinks(text);

        if (urls.length === 0) {
            core.setFailed("Failed to find a URL.");
            return;
        }

        filename = parseName(filename);
        if (typeof filename === "object" && filename.length > 0 && urls.length !== filename.length) {
            core.setFailed("The number of urls does not match the number of filenames.");
            return;
        }

        urls.map((url, key) => console.log(`${key}) URL found: ${url}`))
        try {
            fs.mkdirSync(target, { recursive: true })
        } catch (e) {
            core.setFailed(`Failed to create target directory ${target}: ${e}`);
            return;
        }

        Promise.all(urls.map((url, key) => download(url, filename[key], target)))
            .then((file) => {
                console.log('Saved files:', file);
            })
            .catch((err) => {
                core.setFailed(err.message);
            });
        console.log("Download completed.")
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
