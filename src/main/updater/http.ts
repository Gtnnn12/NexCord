/*
 * NexCord, a modification for Discord's desktop app
 * Based on Vencord
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { IpcEvents } from "@shared/IpcEvents";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { ipcMain } from "electron";
import { writeFile } from "fs/promises";
import { join } from "path";

import gitHash from "~git-hash";

import { serializeErrors, VENCORD_FILES } from "./common";

const API_BASE = "https://api.github.com/repos/Gtnnn12/NexCord";

let PendingUpdates = [] as [string, string][];

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

async function calculateGitChanges() {
    const release = await githubGet<any>("/releases/latest");

    const tag = release.tag_name;

    const data = await githubGet<any>(
        `/compare/${gitHash}...${tag}`
    );

    return data.commits.map((c: any) => ({
        hash: c.sha.slice(0, 7),
        author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
        message: c.commit.message.split("\n")[0]
    }));
}

async function fetchUpdates() {
    const release = await githubGet<any>("/releases/latest");

    const tag = release.tag_name;

    // Obtener los cambios desde nuestra versión instalada
    const data = await githubGet<any>(
        `/compare/${gitHash}...${tag}`
    );

    // Si no hay cambios, estamos actualizados
    if (!data.commits || data.commits.length === 0)
        return false;

    // Limpiar actualizaciones anteriores
    PendingUpdates = [];

    // Buscar nuestros archivos compilados
    release.assets.forEach(({ name, browser_download_url }: any) => {
        if (VENCORD_FILES.some(file => name === file)) {
            PendingUpdates.push([
                name,
                browser_download_url
            ]);
        }
    });

    // Si la release no tiene nuestros archivos, no actualizar
    if (PendingUpdates.length === 0)
        return false;

    return true;
}

async function applyUpdates() {
    const fileContents = await Promise.all(
        PendingUpdates.map(async ([name, url]) => {
            const contents = await fetchBuffer(url);

            return [
                join(__dirname, name),
                contents
            ] as const;
        })
    );

    await Promise.all(
        fileContents.map(async ([filename, contents]) =>
            writeFile(filename, contents)
        )
    );

    PendingUpdates = [];

    return true;
}

ipcMain.handle(
    IpcEvents.GET_REPO,
    serializeErrors(() => "https://github.com/Gtnnn12/NexCord")
);

ipcMain.handle(
    IpcEvents.GET_UPDATES,
    serializeErrors(calculateGitChanges)
);

ipcMain.handle(
    IpcEvents.UPDATE,
    serializeErrors(fetchUpdates)
);

ipcMain.handle(
    IpcEvents.BUILD,
    serializeErrors(applyUpdates)
);
