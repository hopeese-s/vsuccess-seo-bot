const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Use absolute path so it works on Railway too
const CSV_FILE = path.join(__dirname, '..', 'content_calendar.csv');

// Read all rows
function readCalendar() {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(CSV_FILE)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}

// Write all rows back
async function writeCalendar(rows) {
    const csvWriter = createCsvWriter({
        path: CSV_FILE,
        header: [
            { id: 'Keyword', title: 'Keyword' },
            { id: 'Date', title: 'Date' },
            { id: 'Status', title: 'Status' }
        ]
    });
    await csvWriter.writeRecords(rows);
}

// Get next pending keyword
async function getNextPendingKeyword() {
    const rows = await readCalendar();
    const pendingIndex = rows.findIndex(row => row.Status === 'Pending');
    if (pendingIndex !== -1) {
        return {
            row: rows[pendingIndex],
            index: pendingIndex,
            allRows: rows
        };
    }
    return null;
}

// Mark keyword as done
async function markKeywordAsDone(allRows, index) {
    allRows[index].Status = 'Done';
    await writeCalendar(allRows);
}

// Mark keyword as failed
async function markKeywordAsFailed(allRows, index) {
    allRows[index].Status = 'Failed';
    await writeCalendar(allRows);
}

// Get queue status
async function getQueueStatus() {
    const rows = await readCalendar();
    let pending = 0;
    let done = 0;
    let failed = 0;
    let nextKeyword = null;

    for (const row of rows) {
        if (row.Status === 'Pending') {
            pending++;
            if (!nextKeyword) nextKeyword = row.Keyword;
        } else if (row.Status === 'Done') {
            done++;
        } else if (row.Status === 'Failed') {
            failed++;
        }
    }

    return { pending, done, failed, nextKeyword };
}

// Add new keywords to queue
async function addKeywordsToQueue(keywordsList) {
    const rows = await readCalendar();
    
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const newRows = keywordsList.map(kw => ({
        Keyword: kw.trim(),
        Date: dateStr,
        Status: 'Pending'
    })).filter(kw => kw.Keyword !== '');

    if (newRows.length > 0) {
        const combinedRows = rows.concat(newRows);
        await writeCalendar(combinedRows);
        return newRows.length;
    }
    return 0;
}

module.exports = { getNextPendingKeyword, markKeywordAsDone, markKeywordAsFailed, getQueueStatus, addKeywordsToQueue, readCalendar };
