const express = require('express');
const cors = require('cors');
const app = express();
const tikwm = require('./tikvid');
const { MongoClient, ObjectId } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

const databaseName = "Shoti";

// Initialize connection
(async function() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
})();

async function writeData(collection, data) {
  try {
    const database = client.db(databaseName);
    const col = database.collection(collection);
    const result = await col.insertOne(data);
    return result;
  } catch (error) {
    console.log(error);
  }
}

async function readData(collection, filter = {}, options = {}) {
  try {
    const database = client.db(databaseName);
    const col = database.collection(collection);
    const result = await col.find(filter, options).toArray();
    return result;
  } catch (error) {
    console.log(error);
  }
}

async function updateData(collection, dataID, newData) {
  try {
    const database = client.db(databaseName);
    const col = database.collection(collection);
    const result = await col.findOneAndUpdate({ _id: ObjectId(dataID) }, { $set: newData });
    return result;
  } catch (error) {
    console.log(error);
  }
}

async function deleteData(collection, dataID) {
  try {
    const database = client.db(databaseName);
    const col = database.collection(collection);
    const result = await col.deleteOne({ _id: ObjectId(dataID) });
    return result;
  } catch (error) {
    console.log(error);
  }
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/list', async (req, res) => {
  const videos = await readData('videos', {}, { projection: { url: 1, id: 1, addedBy: 1, addedDate: 1 } });
  res.type('json').send(JSON.stringify(videos, null, 2) + '\n');
});

app.get('/api', (req, res) => {
  res.send("Shoti API > See documentation at https://shoti-api.vercel.app");
});

app.post('/api/info', async (req, res) => {
  const { f: method } = req.body;

  if (method === 'leaderboard') {
    const apikeys = await readData('apikeys', {}, { projection: { username: 1, requests: 1 }, sort: { requests: -1 }, limit: 100 });
    const final = apikeys.filter(item => item.requests !== 0).map(item => ({
      username: item.username,
      requests: item.requests
    }));
    res.type('json').send(JSON.stringify(final, null, 2) + '\n');
  } else if (method === 'stats') {
    const [videosCount, usersCount, totalRequests] = await Promise.all([
      readData('videos', {}, { count: true }),
      readData('apikeys', {}, { count: true }),
      readData('apikeys', {}, { projection: { requests: 1 } }).then(keys => keys.reduce((acc, curr) => acc + curr.requests, 0))
    ]);
    res.send({
      videos: videosCount,
      users: usersCount,
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
    if (passkey === process.env.PASSKEY) {
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
    const tk = await readData('tokens', { token }, { projection: { name: 1 } });
    if (!tk.length) return res.send({ success: false, error: "Not authenticated" });

    const uniqueId = [...Array(8)].map(() => Math.random().toString(36)[2] || Math.floor(Math.random() * 10)).join('');
    await writeData('videos', {
      url,
      id: uniqueId,
      addedBy: tk[0].name,
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

    const video = await readData('videos', { url }, { projection: { url: 1 } });
    if (!video.length) {
      res.send({ success: false });
      return;
    }

    const apiKey = await readData('apikeys', { apikey }, { projection: { apikey: 1 } });
    if (!apiKey.length) {
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

    const apiKeyData = await readData('apikeys', { apikey }, { projection: { requests: 1 } });
    if (!apiKeyData.length) {
      return res.status(401).json({
        code: 401,
        message: 'error-apikey-invalid',
      });
    }

    await updateData('apikeys', apiKeyData[0]._id, {
      requests: apiKeyData[0].requests + 1,
    });

    const userRank = (await readData('apikeys', {}, { sort: { requests: -1 }, projection: { apikey: 1 } }))
      .findIndex(item => item.apikey === apiKeyData[0].apikey) + 1;
    
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
  try {
    // Retrieve videos from the database
    const videos = await readData('videos', {}, { projection: { url: 1 }, limit: 3, sort: { addedDate: -1 } });
    const shuffledVideos = shuffle(videos);
    const randomVideo = shuffledVideos[getRandomInt(0, shuffledVideos.length - 1)];

    // Fetch video information using tikwm
    const videoInfo = await tikwm(randomVideo.url, userRank);

    // If the videoInfo retrieval is successful, format the response as required
    if (videoInfo?.code === 200 && videoInfo.data) {
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
    } else {
      // Handle the case where videoInfo is not retrieved successfully
      return {
        code: videoInfo?.code || 500,
        message: videoInfo?.message || 'Failed to retrieve video information',
      };
    }
  } catch (error) {
    console.error('Error generating video:', error);
    return {
      code: 500,
      message: 'Internal Server Error',
      error: error.message,
    };
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
