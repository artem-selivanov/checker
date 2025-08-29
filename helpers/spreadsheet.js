const {google} = require('googleapis')
require('dotenv').config();
let keys = require('../credentials/key.json');

class SheetHandler {
    constructor(url) {
        this.id = url.split("/")[5];
        //this.tab = tab;
        this.api
    }


    async initSheet() {
        //console.log(keys)
        if (this.api != null) return
        const sheet_cl = new google.auth.GoogleAuth({
            credentials: {
                private_key: keys.private_key,
                client_email: keys.client_email,
            },
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
            ],
        });
        const authClientObject = await sheet_cl.getClient();
        this.api = google.sheets({
            version: 'v4',
            auth: authClientObject,
        })
    }

    async setValues(tab, arr, range) {
        if (this.api == null) await this.initSheet()
        const updateOptions = {
            spreadsheetId: this.id,
            range: `${tab}!${range}`,
            valueInputOption: 'USER_ENTERED',
            resource: {values: arr}
        }
        const responce = await this.api.spreadsheets.values.update(updateOptions)
        return responce
    }

    async addRows(row, tab) {
        const arr = await this.getValues(tab)
        const index = arr.length + 1
        await this.setValues(tab, row, `A${index}`)
    }


    async getValues(tab) {
        if (this.api == null) await this.initSheet()
        const updateOptions = {
            spreadsheetId: this.id,
            range: `${tab}`,
        }
        const responce = await this.api.spreadsheets.values.get(updateOptions)
        return responce.data.values
    }

    async clearContent(tab) {
        if (this.api == null) await this.initSheet()
        let tmp = await this.getValues(tab)
        if (typeof tmp === "undefined") return
        const maxrow = tmp.length
        if (tmp.length==0) return
        const sheetId = await this.getSheetId(tab)/*
        var batchUpdateRequest = {
            "requests": [
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": sheetId,
                            "dimension": "ROWS",
                            "startIndex": 1,
                            "endIndex": maxrow
                        }
                    }
                }
            ]
        }*/

        var batchUpdateRequest = {
            "requests": [
                {
                    "updateCells": {
                        "range": {
                            "sheetId": sheetId,
                            "startRowIndex": 1, // Start clearing from the second row (index 1)
                            "endRowIndex": maxrow, // Clear up to maxrow (exclusive)
                            "startColumnIndex": 0, // Start from the first column
                            "endColumnIndex": null // Clear all columns in the row
                        },
                        "fields": "userEnteredValue" // Only clear the values, keep formatting
                    }
                }
            ]
        };

        const response = this.api.spreadsheets.batchUpdate({
            spreadsheetId: this.id,
            resource: batchUpdateRequest
        })
    }

    async getSheetId(tab) {
        //console.log(tab)
        if (this.api == null) await this.initSheet()
        const Options = {
            spreadsheetId: this.id,//"1UBiMG5nOLkZNjW5SNis_snrDhpiThG4TGqRCMn_mX90",
            includeGridData: false,
            ranges: [`${tab}`]
        }
        const responce = await this.api.spreadsheets.get(Options)
        return responce.data.sheets[0].properties.sheetId
    }

}


module.exports = SheetHandler

