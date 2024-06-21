const express = require('express');
const cors = require('cors');
const app = express();
const tikwm = require('./tikvid');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

const databaseName = "Shoti";
let videosCache = [];
let apikeysCache = [];
let tokensCache = [];

// Initialize connection and cache
(async function() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    await refreshCache();
    setInterval(refreshCache, 60000); // Refresh cache every 60 seconds
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
})();

async function refreshCache() {
  try {
    videosCache = await readData('videos');
    apikeysCache = await readData('apikeys');
    tokensCache = await readData('tokens');
    console.log('Cache refreshed');
  } catch (error) {
    console.error('Error refreshing cache:', error);
  }
}

async function writeData(collection, data) {
  try {
    const database = client.db(databaseName);
    const col = database.collection(collection);
    const result = await col.insertOne(data);
    await refreshCache(); // Refresh cache after writing data
    return result;
  } catch (error) {
    console.log(error);
  }
}

async function readData(collection) {
  try {
    const database = client.db(databaseName);
    const col = database.collection(collection);
    const result = await col.find({}).toArray();
    return result;
  } catch (error) {
    console.log(error);
  }
}

async function updateData(collection, dataID, newData) {
  try {
    const database = client.db(databaseName);
    const col = database.collection(collection);
    const result = await col.findOneAndUpdate({ _id: dataID }, { $set: newData });
    await refreshCache(); // Refresh cache after updating data
    return result;
  } catch (error) {
    console.log(error);
  }
}

async function deleteData(collection, dataID) {
  try {
    const database = client.db(databaseName);
    const col = database.collection(collection);
    const result = await col.deleteOne({ _id: dataID });
    await refreshCache(); // Refresh cache after deleting data
    return result;
  } catch (error) {
    console.log(error);
  }
}

function shuffle(array) {
  const newArray = array.slice();
  const useFisherYates = Math.random() < 0.5;

  if (useFisherYates) {
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
  } else {
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * newArray.length);
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
  }

  return newArray;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/list', (req, res) => {
  res.type('json').send(JSON.stringify(videosCache, null, 2) + '\n');
});

app.get('/api', (req, res) => {
  res.send("Shoti API > See documentation at https://shoti-api.vercel.app");
});

app.post('/api/info', (req, res) => {
  let { f: method } = req.body;

  if (method == 'leaderboard') {
    apikeysCache.sort((a, b) => b.requests - a.requests);
    let top = apikeysCache.slice(0, 100).filter(item => item.requests !== 0);
    let final = top.map(item => ({
      username: item.username,
      requests: item.requests
    }));
    res.type('json').send(JSON.stringify(final, null, 2) + '\n');
  } else if (method == 'stats') {
    const totalRequests = apikeysCache.reduce((acc, curr) => acc + curr.requests, 0);
    res.send({
      videos: videosCache.length,
      users: apikeysCache.length,
      requests: totalRequests
    });
  } else {
    res.send({ msg: "Method not allowed" });
  }
});

app.get('/api/generate-token', async (req, res) => {
  const { name, passkey } = req.query;
  const uniqueId = Date.now().toString(32) + Math.random().toString(32).substr(3);
  try {
    if (passkey == process.env.PASSKEY) {
      await writeData('tokens', { name, token: uniqueId });
      res.send(uniqueId);
    } else {
      res.send('error');
    }
  } catch (error) {
    res.send('error');
  }
});

app.post('/api/createkey', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      res.send({ success: false });
      return;
    }

    const uniqueId = Date.now().toString(32) + Math.random().toString(32).substr(3);
    await writeData('apikeys', {
      username: username || 'Unknown',
      apikey: `$shoti-${uniqueId}`,
      requests: 0,
      createdAt: new Date()
    });

    res.send({ success: true, apikey: `$shoti-${uniqueId}` });
  } catch (err) {
    res.send({ success: false });
  }
});

app.post('/api/create-video', async (req, res) => {
  try {
    const { url, token } = req.body;
    if (!token) {
      res.send({ success: false });
      return;
    }
    const tk = tokensCache.find(r => r.token === token);
    if (!tk) return res.send({ success: false, error: "Not authenticated" });

    const uniqueId = [...Array(8)].map(() => Math.random().toString(36)[2] || Math.floor(Math.random() * 10)).join('');
    await writeData('videos', {
      url,
      id: uniqueId,
      addedBy: tk.name,
      addedDate: new Date()
    });

    res.send({ success: true, id: uniqueId, url });
  } catch (err) {
    res.send({ success: false, error: err });
  }
});

app.post('/api/v1/add', async (req, res) => {
  try {
    const { url, apikey } = req.body;
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(3);

    let video = videosCache.find(vid => vid.url === url);
    if (!video) {
      res.send({ success: false });
      return;
    }

    let apiKey = apikeysCache.find(key => key.apikey === apikey);
    if (!apiKey) {
      res.send({ success: false });
      return;
    }

    await writeData('videos', {
      url: url,
      id: uniqueId,
      addedDate: new Date()
    });

    res.send({ success: true, id: uniqueId });
  } catch (err) {
    console.log(err);
    res.send({ success: false });
  }
});

app.post('/api/v1/get', async (req, res) => {
  try {
    const { apikey } = req.body;

    const apiKeyData = apikeysCache.find(key => key.apikey === apikey);
    if (!apiKeyData) {
      return res.status(401).json({
        code: 401,
        message: 'error-apikey-invalid',
      });
    }

    await updateData('apikeys', apiKeyData._id, {
      requests: apiKeyData.requests + 1,
    });

    const userRank = apikeysCache.findIndex(item => item.apikey === apiKeyData.apikey) + 1;
    const videoResponse = await generateVideo(userRank);

    if (videoResponse.code !== 200) {
      const retryResponse = await generateVideo(userRank);
      return res.status(retryResponse.code).json(retryResponse);
    }

    return res.status(200).json(videoResponse);
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ code: 500, error: err.message });
  }
});

app.get('/api/v1/request-f', async (req, res) => {
  const userRank = "ERR_METHOD_NOT_REQUIRE_KEY";
  const videoResponse = await generateVideo(userRank);

  if (videoResponse.code !== 200) {
    const retryResponse = await generateVideo(userRank);
    return res.type('json').send(JSON.stringify(retryResponse, null, 2) + '\n');
  }
  return res.type('json').send(JSON.stringify(videoResponse, null, 2) + '\n');
});

async function generateVideo(userRank) {
  const randomIndex = getRandomInt(0, videosCache.length - 1);
  const video = videosCache[randomIndex];

  try {
    const videoInfo = await tikwm.getVideoInfo(video.url);
    if(!videoInfo.data.duration) {
      return await generateVideo(userRank);
    }
    return {
      code: 200,
      message: 'success',
      data: {
        _shoti_rank: userRank,
        region: videoInfo.data?.region,
        url: 'https://www.tikwm.com/video/media/hdplay/' + videoInfo.data?.id + '.mp4',
        cover: videoInfo.data?.cover,
        title: videoInfo.data?.title,
        duration: `${videoInfo.data?.duration}s`,
        user: {
          username: videoInfo.data?.author?.unique_id,
          nickname: videoInfo.data?.author?.nickname,
          userID: videoInfo.data?.author?.id
        },
      },
    };
  } catch (err) {
    console.error('Error generating video:', err);
    return await generateVideo(userRank);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
