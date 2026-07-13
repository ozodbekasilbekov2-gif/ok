import { Hono } from 'hono'
// @ts-ignore - raw import of the presentation HTML
import presentation from './presentation.html?raw'
// @ts-ignore - raw import of the game HTML
import game from './game.html?raw'

const app = new Hono()

app.get('/', (c) => c.html(presentation))
app.get('/game', (c) => c.html(game))
app.get('/game.html', (c) => c.redirect('/game'))

export default app
