const MongoClient = require('mongodb').MongoClient;

const configs = require('../config/configs').mongoUrl;

let client, attempts = 0;
const dbName = 'words';

getDb = (async () => {
    if (!client) {
        if (attempts > 5) {
            throw new Error("Can't connect to " + configs());
        }
        try {
            console.log("Init connection " + configs());
            client = await MongoClient.connect(configs(), { useUnifiedTopology: true });
            attempts = 0;
        } catch (e) {
            attempts++;
            return getDb();
        }
    }

    return client.db(dbName);
});

async function getCollection (name) {
    const db = await getDb();
    return db.collection(name);
}

module.exports = getCollection;