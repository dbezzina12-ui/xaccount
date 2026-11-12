"""Encode the reviewed one-shot takes for a 1:5 reel, with fast-start H.264.
The images and full-resolution generated takes remain in art/duel-v73.
"""
from pathlib import Path
import io, json, subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/duel-v73'
OUT=ROOT/'dist/assets/duel-v73'
# Trims/cues are measured against the actual generated footage, in seconds.
TAKES={
    'hunter-loses': {'source':'hunter-loses-corrected-source.mp4','start':.15,'duration':2.8,'shot':.65},
    'outlaw-loses': {'source':'outlaw-loses-corrected-source.mp4','start':.65,'duration':2.4,'shot':.85},
    'boss-loses': {'source':'boss-loses-source.mp4','start':.15,'duration':2.8,'shot':.65},
    'boss-wins': {'source':'boss-wins-source.mp4','start':.65,'duration':2.4,'shot':.85},
}
def run(args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*args],check=True)
def write_poster(video,destination):
    # A successful ffmpeg exit alone did not guarantee a nonempty WebP.
    # Decode the actual first frame, encode a static image, then verify it
    # before atomically replacing the published poster.
    frame=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error',
                                   '-i',str(video),'-frames:v','1','-c:v','png',
                                   '-f','image2pipe','pipe:1'])
    temporary=destination.with_suffix('.tmp.webp')
    try:
        with Image.open(io.BytesIO(frame)) as image:
            image.load()
            assert image.size==(256,1280),f'Unexpected poster dimensions: {image.size}'
            image.convert('RGB').save(temporary,format='WEBP',quality=88)
        with Image.open(temporary) as image:
            image.load()
            assert image.format=='WEBP' and image.n_frames==1
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
def encode(key,take):
    source=ART/take['source']
    assert source.is_file(),f'Missing reviewed take: {source}'
    # Narrow crop retains both silhouettes and removes unused side scenery.
    # Small horizontal fitting keeps the gun hands inside the 1:5 reel.
    fit='crop=trunc(ih/4/2)*2:ih:(iw-ow)/2:0,scale=256:1280:flags=lanczos,setsar=1'
    target=OUT/(key+'.mp4')
    run(['-ss',str(take['start']),'-i',str(source),'-t',str(take['duration']),'-an','-vf',fit,
         '-c:v','libx264','-preset','slow','-crf','20','-profile:v','main','-pix_fmt','yuv420p',
         '-g','24','-movflags','+faststart',str(target)])
    write_poster(target,OUT/(key+'-poster.webp'))
    meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size',
                                           '-show_entries','stream=codec_name,width,height,r_frame_rate,nb_frames','-of','json',str(target)]))
    return {**take,'file':target.name,'poster':key+'-poster.webp','encoded':meta}
if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    results={key:encode(key,take) for key,take in TAKES.items()}
    (OUT/'metadata.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps({key:value['encoded']['format'] for key,value in results.items()},indent=2))
