import * as fs from 'fs';
import Tabula from 'fresh-tabula-js';
import parse from 'csv-parse';
import ical from 'ical-generator';
import moment from 'moment';
import * as path from 'path';

const pdfTableAreas = [
    '31.0,30.0,159.375,787.62',
    '165.0,30.0,293.375,787.62',
    '300.0,30.0,427.322,787.62',
    '435.0,30.0,563.375,787.62',
    '94.0,30.0,221.322,787.62 ',
    '229.0,30.0,357.375,787.62',
    '363.005,30.0,491.38,490.885'
];

const roles = {
    8: ['0800', '1600'],
    N: ['2200', '0800'],
    SW: ['0800', '2230'],
    S: ['0800', '2230'],
}

const momentDateString = 'DD-MMM-YY HHmm';

async function getCsv(area: string): Promise<string[]> {
    return new Promise((res, rej) => {
        const table = new Tabula('/home/scott/projects/timesheet/roster.pdf', { area: area });
        table.extractCsv((err, data) => {
            if (err) {
                rej(err);
            }
            res(data);
        });

    })
}

async function parseCsv(csv: string) {
    return new Promise((res, rej) => {
        parse(csv, {
            columns: true
        }, (err, data) => {
            if (err) {
                rej(err);
            }
            res(data);
        })
    })
}

setTimeout(async () => {
    const output: Dict<PersonData> = {};
    for (const area of pdfTableAreas) {
        const lineStrings = await getCsv(area);
        let sanitisedLines = lineStrings.map(l => {
            return l.split(',').slice(1).join(','); //first column is quotes
        }).slice(1); // first row is weeks, useless
        sanitisedLines.splice(1,2); // remove day row and 'reablement'
        const emptyRowIndex = sanitisedLines.findIndex(l => l.indexOf(',,') == 0); // find empty row
        sanitisedLines = sanitisedLines.splice(0, emptyRowIndex); // slice at empty row
        sanitisedLines[0] = sanitisedLines[0].replace('Date', 'Name'); // tidy up header
        const csv = sanitisedLines.join('\n');
        const parsed = await parseCsv(csv) as [];
        for (const person of parsed) {
            let name;
            for (const [key, val] of Object.entries(person)) {
                if (key === 'Name') {
                    name = val;
                } else {
                    if (!output[name]) {
                        output[name] = {
                            cal: ical(),
                            events: [],
                        };
                    }
                    output[name].events.push({date: key, type: val as string});
                    const date = `${key}-19`;
                    const hours = roles[val as string];
                    if (!hours) {
                        continue;
                    }
                    let addedDays = 0;
                    if (hours[0] > hours[1]) {
                        addedDays = 1;
                    }
                    const start = moment(`${date} ${hours[0]}`, momentDateString);
                    const end = moment(`${date} ${hours[1]}`, momentDateString).add({ days: addedDays });
                    output[name].cal.createEvent({
                        start,
                        end,
                        summary: `Work shift (${val})`
                    })
                }
            }
        }
    }
    for (const [name, data] of Object.entries(output)) {
        data.cal.saveSync(`/home/scott/projects/timesheet/output/${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
    }
    debugger
    console.log('done');
}, 1000);

interface Dict<T>{
    [key: string]: T;
}

interface PersonData {
    cal: ical.ICalCalendar;
    events: {date: string, type: string}[];
}