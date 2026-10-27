"""Embed just the document's characters from a static CJK font."""
import io
import string
import sys
import uuid
import zipfile
from pathlib import Path
from lxml import etree

W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG='http://schemas.openxmlformats.org/package/2006/relationships'


def embed_subset(docx_path, font_path, family, helper_wheel=None):
    if helper_wheel:
        sys.path.insert(0,str(Path(helper_wheel).resolve()))
    try:
        from fontTools.ttLib import TTFont
        from fontTools import subset
    except ImportError as exc:
        raise RuntimeError('fontTools is unavailable; pass --fonttools-wheel from the task cache') from exc
    with zipfile.ZipFile(docx_path) as source:
        parts={name:source.read(name) for name in source.namelist()}
    chars=set(string.printable)
    for name,data in parts.items():
        if name.startswith('word/') and name.endswith('.xml'):
            chars.update(''.join(etree.fromstring(data).xpath('//w:t/text()',namespaces={'w':W})))
    font=TTFont(str(font_path),recalcTimestamp=False,recalcBBoxes=False)
    if font['name'].getBestFamilyName()!=family:
        raise ValueError(f'Font family mismatch: expected {family}, got {font["name"].getBestFamilyName()}')
    if font['OS/2'].fsType&2:
        raise ValueError('The selected font restricts embedding')
    available=set(font.getBestCmap())
    missing={c for c in chars if not c.isspace() and ord(c)>=32 and ord(c) not in available}
    if missing:
        raise ValueError(f'Font lacks document characters: {"".join(sorted(missing))}; supply emoji images or a matching font')
    options=subset.Options()
    options.name_IDs=['*'];options.name_languages=['*'];options.name_legacy=True
    options.layout_features=['*'];options.notdef_outline=True;options.desubroutinize=True
    subsetter=subset.Subsetter(options=options)
    subsetter.populate(unicodes={ord(c) for c in chars});subsetter.subset(font)
    buffer=io.BytesIO();font.save(buffer);reduced=bytearray(buffer.getvalue())
    key=uuid.uuid4();mask=bytes.fromhex(key.hex)[::-1]
    for i in range(32):reduced[i]^=mask[i%16]
    table=etree.fromstring(parts['word/fontTable.xml'])
    for node in list(table):
        if node.get('{'+W+'}name')==family:table.remove(node)
    node=etree.SubElement(table,'{'+W+'}font');node.set('{'+W+'}name',family)
    for kind in ['embedRegular','embedBold']:
        entry=etree.SubElement(node,'{'+W+'}'+kind)
        entry.set('{'+R+'}id','rIdBriefingFont');entry.set('{'+W+'}fontKey','{'+str(key).upper()+'}')
        entry.set('{'+W+'}subsetted','true')
    parts['word/fontTable.xml']=etree.tostring(table,xml_declaration=True,encoding='UTF-8',standalone=True)
    rels_name='word/_rels/fontTable.xml.rels'
    rels=etree.fromstring(parts[rels_name]) if rels_name in parts else etree.Element('{'+PKG+'}Relationships',nsmap={None:PKG})
    entry=etree.SubElement(rels,'{'+PKG+'}Relationship')
    entry.set('Id','rIdBriefingFont');entry.set('Type',R+'/font');entry.set('Target','fonts/BriefingCJK.odttf')
    parts[rels_name]=etree.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
    parts['word/fonts/BriefingCJK.odttf']=bytes(reduced)
    types=etree.fromstring(parts['[Content_Types].xml'])
    if not any(n.get('Extension')=='odttf' for n in types):
        entry=etree.SubElement(types,'{http://schemas.openxmlformats.org/package/2006/content-types}Default')
        entry.set('Extension','odttf');entry.set('ContentType','application/vnd.openxmlformats-officedocument.obfuscatedFont')
    parts['[Content_Types].xml']=etree.tostring(types,xml_declaration=True,encoding='UTF-8',standalone=True)
    settings=etree.fromstring(parts['word/settings.xml'])
    if settings.find('{'+W+'}embedTrueTypeFonts') is None:etree.SubElement(settings,'{'+W+'}embedTrueTypeFonts')
    parts['word/settings.xml']=etree.tostring(settings,xml_declaration=True,encoding='UTF-8',standalone=True)
    with zipfile.ZipFile(docx_path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as result:
        for name,data in parts.items():result.writestr(name,data)
    return {'font_subset_bytes':len(reduced),'characters':len(chars),'embedded_font_family':family}
