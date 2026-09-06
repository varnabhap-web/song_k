# song_k — for Kuhu didi

Separate from `song_n` (other sister). Player-only, NFC + iPhone + Vercel.

## Songs

| NFC path | Song |
| --- | --- |
| `/?song=here-comes-the-sun` | The Beatles — Here Comes the Sun |
| `/?song=hey-jude` | The Beatles — Hey Jude |
| `/?song=somebody-that-i-used-to-know` | Gotye — Somebody That I Used to Know |
| `/?song=loser` | Tame Impala — Loser |
| `/?song=sunflower` | Post Malone & Swae Lee — Sunflower |

## Audio

Drop files into `audio/` (see `audio/README.md`). Covers are ready; audio is not downloaded from the internet.

## Local

```bash
cd /Users/vanabhapatra/development/song_k
python3 server.py --port 5191 --host 127.0.0.1
```

http://127.0.0.1:5191/?song=here-comes-the-sun

## Deploy

New **separate** Vercel project → root = this folder. Do not mix with `song_n`.

NFC URL example: `https://YOUR-KUHU-APP.vercel.app/?song=hey-jude`
