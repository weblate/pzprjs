import fs = require('fs');
import path = require('path');
import { VercelResponse } from "@vercel/node";
import { parse_query, pzvdetails } from "./tools"
import sharp from "sharp"
import pzpr from "../dist/js/pzpr.js"

const maskHoriz = fs.readFileSync(path.resolve(process.cwd(), 'src-api/img', 'mask-horiz.png'));
const maskVert = fs.readFileSync(path.resolve(process.cwd(), 'src-api/img', 'mask-vert.png'));

export function preview(res: VercelResponse, url: string) {
	var qargs = parse_query(url);
	if (!qargs || !qargs.pzv) {
		res.statusCode = 400;
		res.end();
		console.log('no pzv found');
		return;
	}
	// deal with <type>_edit links
	var pzv = qargs.pzv.replace(/_edit/, '');

	var details = pzvdetails(pzv);
	if (details.cols > 100 || details.rows > 100) {
		res.statusCode = 404;
		res.end("oversized puzzle");
		console.log('skipping large puzzle:', pzv);
		return;
	}

	const canvas = {};
	const p = new pzpr.Puzzle(canvas);
	p.open(pzv, () => {
		p.setMode('play');
		p.setConfig('undefcell', false);
		p.setConfig('autocmp', false);
		const svg = Buffer.from(p.toBuffer('svg', 0, 30));

		if (qargs.svgout) {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'image/svg+xml');
			res.end(svg);
			return;
		}

		const cols = details.cols;
		const rows = details.rows;
		enum Shape {
			Square,
			Tall,
			Wide,
		}
		var shape = Shape.Square;
		if (!isNaN(cols) && !isNaN(rows)) {
			if (rows/cols >= 2) {
				shape = Shape.Tall;
			} else if (cols/rows >= 2) {
				shape = Shape.Wide;
			}
		}

		res.setHeader('Content-Type', 'image/png')
		res.setHeader('Cache-Control', 'max-age=86400, s-maxage=2592000')

		const s = sharp(svg)
			.trim()
			.toFormat('png')

		if(qargs.thumb) {
			switch(shape) {
				case Shape.Square:
					s.resize({width: 200, height: 200, fit: "inside"})
					break
				case Shape.Tall:
					s.resize({width: 120})
					s.extract({ left: 0, top: 0, width: 120, height: 200 })
					s.composite([{ input: maskVert, blend: 'dest-in' }])
					break
				case Shape.Wide:
					s.resize({height: 120})
					s.extract({ left: 0, top: 0, width: 200, height: 120 })
					s.composite([{ input: maskHoriz, blend: 'dest-in' }])
					break
			}
		}

		s.pipe(res)

		// TODO install fonts
	});
}