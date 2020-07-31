const express = require('express');
const router = express.Router();
const ObjectID = require('mongodb').ObjectID;

const db = require('../database/database');
const dictionary = require('../logic/dictionary');

const prepareInput = (str) => {
    return str.replace(/\s+/g, " ").trim();
};

router.post('/insert', async (req, res) => {
    const _list = req.body;

    const _words = [], _fails = [];
    try {
        await Promise.all(_list.map(async (name) => {
            try {
                const word = await dictionary(prepareInput(name));
                _words.push(word);
            } catch (e) {
                console.error(e.message);
                _fails.push(name);
            }
        }));

        if (_words.length) {
            const _db = await db();
            const _collection = _db.collection('words');
            await _collection.insertMany(_words, { ordered: false });
            res.status(200).send(_fails);
        } else
            throw new Error(`404 - Not found ${_fails.join()}`);

    } catch (e) {
        console.error("ERROR: " + e.message);
        //TODO: re-think errors handling
        let status = e.message.includes('E11000 duplicate key error collection') ? 200 : 500;
        status = e.message.includes('404') ? 404 : status;

        res.status(status).send();
    }
});

router.get('/find', async (req, res) => {
    const _query = JSON.parse(req.query.q) || {};
    const _filter = JSON.parse(req.query.f) || {};

    try {
        const _db = await db();
        const _collection = _db.collection('words');

        const _result = await _collection.find(_query, _filter).toArray();
        res.status(200).send(_result);
    } catch (e) {
        console.error(e.message);
        res.status(500).send();
    }
});

router.post('/update-translation/:id', async (req, res) => {
    const value = req.body.translation;

    try {
        const _db = await db();
        const _collection = _db.collection('words');
        //TODO: change logic - replace findOne & unshift part
        const _word = await _collection.findOne({ _id: ObjectID(req.params.id) });
        _word.translation.unshift(value);

        _collection.updateOne(
            { _id: ObjectID(req.params.id) },
            {
                $set: {
                    translation: [...new Set(_word.translation)]
                }
            });
        res.status(200).send();

    } catch (e) {
        console.error(e.message);
        res.status(500).send();
    }
});

router.post('/quiz-result', async (req, res) => {
    // array of origin words
    const _words = req.body.words;
    // object of answers
    const _answers = req.body.answers;
    const _failed = [], _failedIds = [], _fixedIds = [];

    //compare user answers with correct values
    _words.forEach((word) => {
        const answer = _answers[word._id];
        if (!answer || word.firstCase !== prepareInput(answer.firstCase)
            || word.secondCase !== prepareInput(answer.secondCase)
            || word.thirdCase !== prepareInput(answer.thirdCase)) {
            word.failed = true;
            _failedIds.push(ObjectID(word._id));
            _failed.push(word);
        } else {
            // if you failed word before, but now not --> change failed status
            if (word.failed) _fixedIds.push(ObjectID(word._id));
        }
    });

    //update db
    try {
        const _db = await db();
        const _collection = _db.collection('words');
        if (_fixedIds.length) {
            await _collection.updateMany({ _id: { $in: _fixedIds } }, { $set: { "failed": false } });
        }
        if (_failedIds.length) {
            await _collection.updateMany({ _id: { $in: _failedIds } }, { $set: { "failed": true } });
        }
    } catch (e) {
        console.error(e.message);
        res.status(500).send([]);
    }

    res.status(200).send(_failed);
});

module.exports = router;