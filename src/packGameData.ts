import { parse, QM, ParamType, ParamCritType, getImagesListFromQmm } from './lib/qmreader';

import * as pako from 'pako';
import * as fs from 'fs';

import { QMPlayer, QMImages } from './lib/qmplayer'


export type Origin = string;

export type Lang = 'rus' | 'eng';

export interface Game {
    filename: string,
    description?: string,
    smallDescription?: string,
    gameName: string,
    images: QMImages,
    questOrigin: Origin,
    oldTgeBehaviour: boolean,
    hardness: number,
    lang: Lang
}

export interface CacheFilesList {
    files: {
        path: string,
        size: number,
    }[],
    totalSize: number,
}

export interface Index {
    quests: Game[],    
    dir: {
        quests: CacheFilesList,
        images: CacheFilesList,
        music: CacheFilesList
    }
}

let warns: string[] = [];

const dataSrcPath = __dirname + '/../borrowed'
const dataDstPath = __dirname + '/../build-web/data'

const resultJsonFile = dataDstPath + '/index.json.gz';


function readPqi(filename: string) {
    let result: {
        [name: string]: QMImages
    } = {};

    if (!fs.existsSync(filename)) {
        warns.push(`==========\nPQI file ${filename} not found, will process without\n======`);
        return result
    }
    const content = fs.readFileSync(filename).toString();
    let currentName = '';
    for (const line of content.split(/\r\n|\n/)
        .map(x => x.replace(/ /g, '')).filter(x => x)) {
        if (line.startsWith('//')) {
            currentName = line.slice(2).replace(/\.qm$/, '').toLowerCase();
            continue
        }
        const [data1, data2] = line.split('=');
        const filename = data2.replace(/.*\./g, '').toLowerCase() + '.jpg';
        if (!fs.existsSync(dataDstPath + '/img/' + filename)) {
            warns.push(`File '${filename}' (${dataSrcPath + '/img/' + filename}) not found`);
            continue;
        }
        const d = data1.split(',');
        d.shift();
        const type = d.shift() as 'L' | 'P' | 'PAR';
        const indexes = d.map(x => parseInt(x)).map(x => type === 'PAR' ? x - 1 : x)
        if (!result[currentName]) {
            result[currentName] = []
        }
        const indexesNames = type === 'L' ? 'locationIds' :
            type === 'P' ? 'jumpIds' : 'critParams'

        result[currentName].push({
            filename,
            [indexesNames]: indexes
        })
    }
    let newResult: typeof result = {};
    for (const k of Object.keys(result)) {
        let allImages: { [name: string]: boolean } = {};
        for (const x of result[k]) {
            allImages[x.filename] = true;
        }
        newResult[k] = [];
        for (const image of Object.keys(allImages)) {
            newResult[k].push({
                filename: image,
                critParams: ([] as number[]).concat(
                    ...result[k].filter(x => x.filename === image).map(x => x.critParams || [])),
                locationIds: ([] as number[]).concat(
                    ...result[k].filter(x => x.filename === image).map(x => x.locationIds || [])),
                jumpIds: ([] as number[]).concat(
                    ...result[k].filter(x => x.filename === image).map(x => x.jumpIds || [])),

            })
        }
    }
    return newResult;
}


function checkQm(q: QM) {
    // asd
}


console.info(`Creating destination folders`)
if (!fs.existsSync(dataDstPath)) {
    fs.mkdirSync(dataDstPath);
}
for (const d of ['img', 'qm', 'music']) {
    if (!fs.existsSync(dataDstPath + '/' + d)) {
        fs.mkdirSync(dataDstPath + '/' + d);
    }
}

let index: Index = {
    quests: [],    
    dir: {
        quests: { files: [], totalSize: 0 },
        images: { files: [], totalSize: 0 },
        music: { files: [], totalSize: 0 },
    }
}

const DEBUG_SPEEDUP_SKIP_COPING = false;

console.info(`Scan and copy images`)
const allImages = fs.readdirSync(dataSrcPath + '/img')
    .filter(x => fs.statSync(dataSrcPath + '/img/' + x).isFile())
    .map(imgShortName => {
        const filePath = 'img/' + imgShortName.toLowerCase();
        if (!DEBUG_SPEEDUP_SKIP_COPING) {
            fs.writeFileSync(dataDstPath + '/' + filePath,
                fs.readFileSync(dataSrcPath + '/img/' + imgShortName));
        }
        const fileSize = fs.statSync(dataSrcPath + '/img/' + imgShortName).size;
        index.dir.images.files.push({ path: filePath, size: fileSize });
        index.dir.images.totalSize += fileSize;

        return imgShortName.toLowerCase();
    })

console.info(`Copying music`);
const music = fs.readdirSync(dataSrcPath + '/music')
    .filter(x => {
        const fullName = dataSrcPath + '/music/' + x;
        return fs.statSync(fullName).isFile && (
            fullName.toLowerCase().endsWith('.ogg') || fullName.toLowerCase().endsWith('.mp3'))
    }).map(x => {
        const name = `music/${x}`;
        if (!DEBUG_SPEEDUP_SKIP_COPING) {
            fs.writeFileSync(dataDstPath + '/' + name,
                fs.readFileSync(dataSrcPath + '/' + name));
        }
        const fileSize = fs.statSync(dataDstPath + '/' + name).size;
        index.dir.music.files.push({ path: name, size: fileSize });
        index.dir.music.totalSize += fileSize;

        return name;
    });




const pqi = readPqi(dataSrcPath + '/PQI.txt');
console.info(`Found ${Object.keys(pqi).length} quests in PQI.txt`);
//let pqiFound: string[] = [];


console.info(`Scanning quests`);
let seenQuests: string[] = [];
for (const origin of fs.readdirSync(dataSrcPath + '/qm')) {
    console.info(`Scanning origin ${origin}`)
    const qmDir = dataSrcPath + '/qm/' + origin + '/';
    for (const qmShortName of fs.readdirSync(qmDir)) {
        if (seenQuests.indexOf(qmShortName) > -1) {
            throw new Error(`Duplicate file ${qmShortName}. Please rename it!`)
        } else {
            seenQuests.push(qmShortName)
        }
        const srcQmName = qmDir + qmShortName;
        const lang = origin.endsWith('eng') ? 'eng' : 'rus';
        const oldTge = origin.startsWith('Tge');
        const gameName = qmShortName.replace(/(\.qm|\.qmm)$/, '')
            .replace(/_eng$/, '');
        console.info(`Reading ${srcQmName} (${lang}, oldTge=${oldTge}) gameName=${gameName}`);

        const data = fs.readFileSync(srcQmName);

        if (!DEBUG_SPEEDUP_SKIP_COPING) {
            fs.writeFileSync(dataDstPath + '/qm/' + qmShortName + '.gz', new Buffer(pako.gzip(data)));
        }

        const quest = parse(data);
        const player = new QMPlayer(quest, undefined, lang, oldTge);
        player.start();



        const probablyThisQuestImages = allImages
            .filter(x => x.toLowerCase().startsWith(gameName.toLowerCase()));
        const randomImages = probablyThisQuestImages.map((filename, fileIndex) => {
            return {
                filename: filename,
                locationIds: quest.locations
                    .map(loc => loc.id)
                    .filter(id => (id - 1) % probablyThisQuestImages.length === fileIndex)
            }
        })

        const pqiImages = pqi[gameName.toLowerCase()];
        const images = pqiImages || randomImages;
        //if (pqi[gameName.toLowerCase()]) {
        //pqiFound.push(gameName.toLowerCase());
        //}
        if (pqiImages) {
            for (const pqiImage of pqiImages) {
                if (allImages.indexOf(pqiImage.filename.toLowerCase()) < 0) {
                    warns.push(`Image ${pqiImage.filename} is from PQI for ${qmShortName}, ` +
                        `but not found in img dir`)
                }
            }
        }


        for (const imgFromQmm of getImagesListFromQmm(quest)) {
            if (allImages.indexOf(imgFromQmm.toLowerCase() + '.jpg') < 0) {
                warns.push(`Image ${imgFromQmm} is from ${qmShortName}, but not found in img dir`)
            }
        };


        const gameFilePath = 'qm/' + qmShortName + '.gz';
        const game: Game = {
            filename: gameFilePath,
            description: player.getState().text.replace(/<clr>|<clrEnd>/g, ''),
            smallDescription: lang === 'rus' ? `Сложность: ${quest.hardness}, из ${origin}` :
                `Hardness: ${quest.hardness}, from ${origin}`,
            gameName,
            images,
            hardness: quest.hardness,
            questOrigin: origin,
            oldTgeBehaviour: oldTge,
            lang
        }

        index.quests.push(game);

        const gzFileSize = fs.statSync(dataDstPath + '/qm/' + qmShortName + '.gz').size;
        index.dir.quests.files.push({
            path: gameFilePath,
            size: gzFileSize
        });
        index.dir.quests.totalSize += gzFileSize;
    }
}


index.quests = index.quests.sort((a, b) =>
    a.hardness - b.hardness || (a.gameName > b.gameName ? 1 : -1));
console.info(`Done read, writing result into ${resultJsonFile}`);
fs.writeFileSync(resultJsonFile, new Buffer(pako.gzip(JSON.stringify(index, null, 4))));
//fs.writeFileSync(resultJsonFile, JSON.stringify(index, null, 4));

if (warns.length === 0) {
    console.info('All done, no warnings')
} else {
    console.info(`Done with warnings:\n${warns.join('\n')}`)
}
