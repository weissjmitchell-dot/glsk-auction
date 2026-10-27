from pathlib import Path
import plistlib, re, os
root = Path('ios/App')
p = root/'App/Info.plist'
with p.open('rb') as f: data=plistlib.load(f)
data['NSCameraUsageDescription']='Join an optional GLSK draft-room video call.'
data['NSMicrophoneUsageDescription']='Speak in an optional GLSK draft-room video call.'
data['ITSAppUsesNonExemptEncryption']=False
data['CFBundleDisplayName']='GLSK'
with p.open('wb') as f: plistlib.dump(data,f)
p=root/'App.xcodeproj/project.pbxproj'
s=p.read_text()
s=re.sub(r'MARKETING_VERSION = [^;]+;', 'MARKETING_VERSION = 1.0;', s)
build=os.environ.get('BUILD_NUMBER','1')
if not build.isdigit(): raise ValueError('BUILD_NUMBER must be numeric')
s=re.sub(r'CURRENT_PROJECT_VERSION = [^;]+;', 'CURRENT_PROJECT_VERSION = '+build+';', s)
p.write_text(s)
