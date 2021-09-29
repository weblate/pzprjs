import { VercelResponse, VercelRequestQuery } from "@vercel/node";
import { parse_query, pzvdetails } from "./tools"
import sharp from "sharp"
import pzpr from "../dist/js/pzpr.js"

export function preview(res: VercelResponse, query: VercelRequestQuery) {
	if (!query) {
		res.statusCode = 400;
		res.end();
		return;
	}
	var qargs = parse_query(query);
	if (!qargs.pzv) {
		res.statusCode = 400;
		res.end();
		console.log('no pzv found:', query);
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

		p.setMode('play');
		p.setConfig('undefcell', false);
		p.setConfig('autocmp', false);
		const svg = Buffer.from(p.toBuffer('svg', 0, 30));

		res.setHeader('Content-Type', 'image/png')
		res.setHeader('Cache-Control', 'max-age=86400, s-maxage=2592000')

		const s = sharp(svg)
			.toFormat('png')
			.pipe(res)

		// TODO apply mask and resize
		// TODO install fonts
	});
}