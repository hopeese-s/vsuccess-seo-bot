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

module.exports = { getNextPendingKeyword, markKeywordAsDone, markKeywordAsFailed };
