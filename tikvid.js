const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');

function extractData(html) {
  try {
    const $ = cheerio.load(html);
    
    const poster = $('[poster]').attr('poster');
    const url = $('[data-src]').attr('data-src');
    return {
      poster, 
      url
    };
  } catch (error) {
    console.log("Extract error:", error);
  }
}

//Kim API © Credits
/*
TEMPORARILY USE TO GET METADATA
*/

async function getMeta(url) {
  const response = await axios.get(`https://tiktokmp3mp4-dl.vercel.app/api?url=${url}`);
  return response.data;
}

const getVideoInfo = async (url) => {
  try {
    const response = await axios.post('https://tikvid.io/api/ajaxSearch', querystring.stringify({
      q: url,
      lang: 'en'
    }), 
    {
      headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
    }
    });
    const meta = await getMeta(url);
    return {poster: meta.thumbnail_url, url: meta.mp4, username: meta.author_unique_id, nickname: meta.author_name, title: meta.title }
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = { getVideoInfo };