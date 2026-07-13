import { Hono } from 'hono'
// @ts-ignore - raw import of the presentation HTML
import presentation from './presentation.html?raw'

const app = new Hono()

app.get('/', (c) => c.html(presentation))

export default app
