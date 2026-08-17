import GAME from '../core/game.js';

var G = GAME;

function key(c, r){ return c + ':' + r; }

export function isSlopeBrush(v){
  return G.isSlopeV(v) && v !== G.LADR && v !== G.LADL;
}

function continueTile(c, r, brush){
  var rise = G.slopeRiseRight(brush);
  var neigh = rise ? G.tileAt(c - 1, r) : G.tileAt(c + 1, r);
  var ns = G.slopeSpec(neigh);
  if (!ns) return brush;
  var fams = [G.slopeFamily(brush) || '2', '2', '4', 'curve', '45'];
  var seen = {}, fi, i, arr, s, fam;
  for (fi = 0; fi < fams.length; fi++){
    fam = fams[fi];
    if (!fam || seen[fam] || !G.SLOPE_SEQ[fam]) continue;
    seen[fam] = true;
    arr = rise ? G.SLOPE_SEQ[fam].r : G.SLOPE_SEQ[fam].l;
    for (i = 0; i < arr.length; i++){
      s = G.slopeSpec(arr[i]);
      if (!s) continue;
      if (rise && Math.abs(s.y0 - ns.y1) < 0.5) return arr[i];
      if (!rise && Math.abs(s.y1 - ns.y0) < 0.5) return arr[i];
    }
  }
  return brush;
}

function uniqueByCol(cells){
  var seen = {}, out = [], i, cols;
  for (i = 0; i < cells.length; i++) seen[cells[i].c] = cells[i];
  cols = Object.keys(seen).map(Number).sort(function(a, b){ return a - b; });
  for (i = 0; i < cols.length; i++) out.push(seen[cols[i]]);
  return out;
}

function assignSeq(cells, seq, out){
  for (var i = 0; i < cells.length; i++)
    out.push({ c: cells[i].c, r: cells[i].r, v: seq[i % seq.length] });
}

function pickRampFamily(cells, brushFam){
  if (brushFam === 'curve') return 'curve';
  var dc = cells[cells.length - 1].c - cells[0].c;
  var dr = cells[cells.length - 1].r - cells[0].r;
  var sameRow = true, i;
  for (i = 1; i < cells.length; i++) if (cells[i].r !== cells[0].r){ sameRow = false; break; }
  if (sameRow) return cells.length <= 2 ? '2' : '4';
  var ratio = Math.abs(dc) / Math.max(Math.abs(dr), 0.001);
  if (ratio >= 3.2) return '4';
  if (ratio >= 1.35) return '2';
  return '45';
}

function fitHillPit(cells, mid, isHill){
  var left = cells.slice(0, mid + 1);
  var right = cells.slice(mid + 1);
  var lf = left.length >= 3 ? '4' : (left.length <= 1 ? '45' : 'curve');
  var rf = right.length >= 3 ? '4' : (right.length <= 1 ? '45' : 'curve');
  var lseq = isHill ? G.SLOPE_SEQ[lf].r : G.SLOPE_SEQ[lf].l;
  var rseq = isHill ? G.SLOPE_SEQ[rf].l : G.SLOPE_SEQ[rf].r;
  var out = [];
  assignSeq(uniqueByCol(left), lseq, out);
  assignSeq(uniqueByCol(right), rseq, out);
  if (isHill){
    var baseR = Math.max(cells[0].r, cells[cells.length - 1].r);
    var occupied = {}, i, rr, cc;
    for (i = 0; i < out.length; i++) occupied[key(out[i].c, out[i].r)] = true;
    for (i = 0; i < out.length; i++){
      cc = out[i].c;
      for (rr = out[i].r + 1; rr <= baseR; rr++){
        if (occupied[key(cc, rr)]) continue;
        out.push({ c: cc, r: rr, v: G.ROCK });
        occupied[key(cc, rr)] = true;
      }
    }
  }
  return out;
}

export function fitSlopeStroke(cells, brush){
  if (!cells.length) return [];
  if (cells.length === 1)
    return [{ c: cells[0].c, r: cells[0].r, v: continueTile(cells[0].c, cells[0].r, brush) }];

  var uniq = [], seen = {}, i, k;
  for (i = 0; i < cells.length; i++){
    k = key(cells[i].c, cells[i].r);
    if (seen[k]) continue;
    seen[k] = true;
    uniq.push(cells[i]);
  }

  var cols = {};
  for (i = 0; i < uniq.length; i++) cols[uniq[i].c] = true;
  if (Object.keys(cols).length < 2){
    return uniq.map(function(cl){ return { c: cl.c, r: cl.r, v: brush }; });
  }

  var peakI = 0, valleyI = 0;
  for (i = 1; i < uniq.length; i++){
    if (uniq[i].r < uniq[peakI].r) peakI = i;
    if (uniq[i].r > uniq[valleyI].r) valleyI = i;
  }
  var n = uniq.length;
  var hill = peakI > 0 && peakI < n - 1 && uniq[peakI].r < uniq[0].r && uniq[peakI].r <= uniq[n - 1].r;
  var pit = valleyI > 0 && valleyI < n - 1 && uniq[valleyI].r > uniq[0].r && uniq[valleyI].r >= uniq[n - 1].r;
  if (hill) return fitHillPit(uniq, peakI, true);
  if (pit) return fitHillPit(uniq, valleyI, false);

  var fam = pickRampFamily(uniq, G.slopeFamily(brush));
  var rise = G.slopeRiseRight(brush);
  var seq = rise ? G.SLOPE_SEQ[fam].r : G.SLOPE_SEQ[fam].l;
  var out = [];
  assignSeq(uniqueByCol(uniq), seq, out);
  return out;
}
