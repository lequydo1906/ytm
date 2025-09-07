// Cloudflare Worker - YouTube to MP3 API
// File: worker.js

// QUAN TRỌNG: Đọc kỹ hướng dẫn triển khai ở dưới

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(request.url)
  const path = url.pathname

  try {
    switch (path) {
      case '/api/info':
        return await getVideoInfo(request)
      case '/api/convert':
        return await convertVideo(request)
      case '/api/download':
        return await downloadFile(request)
      default:
        return new Response('Not Found', { status: 404, headers: corsHeaders })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Lấy thông tin video từ YouTube
async function getVideoInfo(request) {
  const url = new URL(request.url)
  const videoUrl = url.searchParams.get('url')
  
  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const videoId = extractVideoId(videoUrl)
  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Sử dụng YouTube Data API alternative (noembed)
  const apiUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
  
  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        videoId: videoId,
        title: data.title || 'Unknown Title',
        author: data.author_name || 'Unknown Author',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: data.duration || null
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch video info' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Convert video (sử dụng external service)
async function convertVideo(request) {
  const body = await request.json()
  const { videoUrl, quality = '128' } = body
  
  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'Video URL is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const videoId = extractVideoId(videoUrl)
  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // QUAN TRỌNG: Đây là phần cần service external
  // Cloudflare Workers không thể chạy youtube-dl hoặc ffmpeg trực tiếp
  // Bạn cần sử dụng một trong các giải pháp sau:

  // Option 1: Sử dụng external API service (có phí)
  // Ví dụ: RapidAPI, Youtube-MP3 API services
  
  // Option 2: Tự host conversion service
  // Setup một VPS/Server riêng với youtube-dl + ffmpeg
  // Cloudflare Worker sẽ forward request đến server này

  // Demo response structure
  return new Response(JSON.stringify({
    success: true,
    message: 'Conversion started',
    jobId: generateJobId(),
    estimatedTime: 30,
    note: 'Để hoạt động thực, cần tích hợp với external conversion service'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Download file từ R2 storage
async function downloadFile(request) {
  const url = new URL(request.url)
  const fileId = url.searchParams.get('id')
  
  if (!fileId) {
    return new Response(JSON.stringify({ error: 'File ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Truy cập Cloudflare R2 bucket
  // Cần setup R2 binding trong wrangler.toml
  try {
    // const object = await MY_BUCKET.get(fileId)
    // if (!object) {
    //   return new Response('File not found', { status: 404 })
    // }
    
    // return new Response(object.body, {
    //   headers: {
    //     ...corsHeaders,
    //     'Content-Type': 'audio/mpeg',
    //     'Content-Disposition': `attachment; filename="${fileId}.mp3"`
    //   }
    // })

    // Demo response
    return new Response(JSON.stringify({
      message: 'R2 storage integration needed',
      fileId: fileId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Download failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Helper functions
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
  const match = url.match(regex)
  return match ? match[1] : null
}

function generateJobId() {
  return Math.random().toString(36).substring(2, 15)
}

// ============================================
// wrangler.toml - Cloudflare Worker config
// ============================================
/*
name = "youtube-mp3-api"
main = "worker.js"
compatibility_date = "2023-05-18"

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "youtube-mp3-storage"

[env.production]
vars = { ENVIRONMENT = "production" }

# Nếu sử dụng external API
[vars]
CONVERSION_API_KEY = "your-api-key"
CONVERSION_API_URL = "https://your-conversion-service.com"
*/

// ============================================
// package.json
// ============================================
/*
{
  "name": "youtube-mp3-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler publish"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
*/

// ============================================
// EXTERNAL CONVERSION SERVICE (Node.js)
// Chạy trên VPS/Server riêng
// ============================================
/*
// server.js - External conversion service
const express = require('express')
const ytdl = require('ytdl-core')
const ffmpeg = require('fluent-ffmpeg')
const AWS = require('aws-sdk')
const app = express()

// Configure S3-compatible storage (R2)
const s3 = new AWS.S3({
  endpoint: 'https://<account-id>.r2.cloudflarestorage.com',
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  signatureVersion: 'v4',
})

app.post('/convert', async (req, res) => {
  const { videoId, quality } = req.body
  
  try {
    // Download video
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const stream = ytdl(videoUrl, { quality: 'highestaudio' })
    
    // Convert to MP3
    const outputPath = `/tmp/${videoId}.mp3`
    
    ffmpeg(stream)
      .audioBitrate(quality)
      .save(outputPath)
      .on('end', async () => {
        // Upload to R2
        const fileContent = fs.readFileSync(outputPath)
        
        await s3.putObject({
          Bucket: 'youtube-mp3-storage',
          Key: `${videoId}-${quality}.mp3`,
          Body: fileContent,
          ContentType: 'audio/mpeg'
        }).promise()
        
        // Clean up
        fs.unlinkSync(outputPath)
        
        res.json({ 
          success: true, 
          fileId: `${videoId}-${quality}.mp3` 
        })
      })
      .on('error', (err) => {
        res.status(500).json({ error: err.message })
      })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(3000, () => {
  console.log('Conversion service running on port 3000')
})
*/

// ============================================
// FRONTEND INTEGRATION
// ============================================
/*
// Cập nhật frontend để sử dụng API
async function convertVideo() {
  const videoUrl = document.getElementById('urlInput').value
  
  // Step 1: Get video info
  const infoResponse = await fetch(`https://your-worker.workers.dev/api/info?url=${encodeURIComponent(videoUrl)}`)
  const info = await infoResponse.json()
  
  // Step 2: Start conversion
  const convertResponse = await fetch('https://your-worker.workers.dev/api/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      videoUrl: videoUrl,
      quality: selectedQuality 
    })
  })
  const job = await convertResponse.json()
  
  // Step 3: Poll for completion (or use WebSocket)
  // ...
  
  // Step 4: Download
  window.location.href = `https://your-worker.workers.dev/api/download?id=${job.fileId}`
}
*/

// ============================================
// DEPLOYMENT STEPS
// ============================================
/*
1. Install Wrangler CLI:
   npm install -g wrangler

2. Login to Cloudflare:
   wrangler login

3. Create R2 bucket:
   wrangler r2 bucket create youtube-mp3-storage

4. Deploy Worker:
   wrangler publish

5. Setup external conversion service:
   - Deploy Node.js server với ytdl-core và ffmpeg
   - Configure R2 credentials
   - Update Worker để gọi đến service này

6. Configure custom domain (optional):
   wrangler route add your-api.com/*
*/

// ============================================
// LEGAL DISCLAIMER
// ============================================
/*
QUAN TRỌNG - CẢNH BÁO PHÁP LÝ:

1. Việc download video từ YouTube có thể vi phạm Điều khoản dịch vụ của YouTube
2. Chỉ download nội dung không có bản quyền hoặc có quyền sử dụng
3. Triển khai production cần:
   - Terms of Service rõ ràng
   - DMCA compliance
   - Rate limiting và monitoring
   - Chỉ cho phép nội dung Creative Commons hoặc Public Domain

4. Alternatives hợp pháp:
   - Sử dụng YouTube Data API chính thức
   - Embed YouTube player
   - Hợp tác với YouTube Content ID partners

Đây chỉ là code demo cho mục đích học tập.
Không khuyến khích sử dụng cho mục đích thương mại
mà không có giấy phép phù hợp.
*/