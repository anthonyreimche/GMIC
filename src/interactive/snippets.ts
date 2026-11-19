// G'MIC commands that apply what G'MIC's interactive windows would have drawn,
// with no window: the final passes of x_color_curves, x_warp and x_colorize,
// taken from G'MIC 4.0.7's source and checked against gmic 4.0.7. Kept as
// lines of plain strings: G'MIC's `${…}` must not meet a template literal.

/** `_sl_curves <space>,"<C0,-1,C1,-1,…>"`: five curves of x,y pairs in
 *  0–100, each a 0–255 LUT on one channel of the colour space (0 rgb, 1 cmy,
 *  2 cmyk, 3 hsi, 4 hsl, 5 hsv, 6 lab, 7 lch, 8 ycbcr), through G'MIC's
 *  cubic Hermite `function1d 1`. */
export const CURVES = [
  "_sl_curves : check \"isint($1,0,8)\"",
  "  repeat 5 { _slc$>=0,0,100,100 }",
  "  if narg($2)",
  "    l[] { ($2) s -,-1 repeat $! { _slc$>={$>,^} } rm }",
  "  fi",
  "  cs=${arg0\\ $1,rgb,cmy,cmyk,hsi,hsl,hsv,lab,lch,ycbcr}",
  "  if ['$cs']=='rgb' m \"_slgo:\" m \"_slback:\"",
  "  elif ['$cs']=='cmy' m \"_slgo: s c,-3 rgb2cmy[0] a c\" m \"_slback: s c,-3 cmy2rgb[0] a c\"",
  "  elif ['$cs']=='cmyk' m \"_slgo: s c,-3 rgb2cmyk[0] a c\" m \"_slback: s c,-4 cmyk2rgb[0] a c\"",
  "  elif ['$cs']=='hsi' m \"_slgo: s c,-3 rgb2hsi8[0] a c\" m \"_slback: s c,-3 hsi82rgb[0] a c\"",
  "  elif ['$cs']=='hsl' m \"_slgo: s c,-3 rgb2hsl8[0] a c\" m \"_slback: s c,-3 hsl82rgb[0] a c\"",
  "  elif ['$cs']=='hsv' m \"_slgo: s c,-3 rgb2hsv8[0] a c\" m \"_slback: s c,-3 hsv82rgb[0] a c\"",
  "  elif ['$cs']=='lab' m \"_slgo: s c,-3 srgb2rgb[0] apo[0] rgb2lab8,0,4 a c\" m \"_slback: s c,-3 apo[0] lab82rgb,0,4 rgb2srgb[0] a c\"",
  "  elif ['$cs']=='lch' m \"_slgo: s c,-3 srgb2rgb[0] apo[0] rgb2lch8[0],0,4 a c\" m \"_slback: s c,-3 apo[0] lch82rgb[0],0,4 rgb2srgb[0] a c\"",
  "  else m \"_slgo: s c,-3 rgb2ycbcr[0] a c\" m \"_slback: s c,-3 ycbcr2rgb[0] a c\"",
  "  fi",
  "  to_color",
  "  foreach {",
  "    _slgo",
  "    repeat s { function1d[] 1,${_slc$>} *. {255%} r. 256,1,1,1,5 c. 0,255 sh[0] $> map. .. rm[-2,-1] }",
  "    _slback",
  "  }",
  "  um _slgo,_slback",
].join("\n");

/** `_sl_warp "<dx,dy,sx,sy,…>"`: keypoints in % of the image; the output at
 *  (dx,dy) shows the source at (sx,sy). The RBF field is singular without
 *  the four corner anchors, so callers always pass them. */
export const WARP = [
  "_sl_warp : check \"isint(${2=1},1)\"",
  "  if narg($1)>=16",
  "    foreach {",
  "      ($1) r. 4,{w/4},1,1,-1 permute. zycx",
  "      _x_warp_rbf[1] {0,round([w,h]/$2)}",
  "      if $2>1 *[1] $2 r[1] {0,[w,h]},1,100%,3 fi",
  "      +[1] '[x,y]'",
  "      warp[0] [1],0,2,3",
  "      rm[1]",
  "    }",
  "  fi",
].join("\n");

/** `_sl_colorize <type>,"<x,y,r,g,b,…>"`: colour points, x and y in % of the
 *  image, r, g and b in 0–255; type 0 a black-and-white photograph (its
 *  luminance kept), 1 line art. */
export const COLORIZE = [
  "_sl_colorize : check \"isint($1,0,1)\"",
  "  if narg($2)>=5",
  "    foreach {",
  "      w,h={w},{h}",
  "      if $1 +channels 0,0 n. 0,255",
  "      elif s==1 +. 0",
  "      else +luminance.",
  "      fi",
  "      => img",
  "      l[] {",
  "        ($2) r. 5,{w/5},1,1,-1",
  "        {h},6,1,1,\"y==2?0:y==0?round(i(#0,0,x)*($w-1)/100):y==1?round(i(#0,1,x)*($h-1)/100):i(#0,y-1,x)+1\"",
  "        k.",
  "      }",
  "      => points",
  "      [img] __x_colorize. $1",
  "      pointcloud[points] -1,$w,$h",
  "      +compose_channels[points] max !=. 0 distance. 1 *. 0.02 +. 1 ^. -1 +[potential,-1]",
  "      if !$1 dilate[points] 3 fi",
  "      watershed[points] [potential] -[points] 1 =>[points] colors",
  "      k[img,colors]",
  "      if $1 +*[img] -1 +. 255 channels. -3,0 blend[colors,-1] alpha rm[img]",
  "      else rgb2ycbcr[colors] j[colors] [img],0,0,0,0 rm[img] ycbcr2rgb[colors]",
  "      fi",
  "      k[colors]",
  "    }",
  "  fi",
].join("\n");
