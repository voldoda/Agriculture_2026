"""Build the v1.0.0 demo Markdown/PDF documents; application runtime does not need Python."""
from pathlib import Path
import argparse, json, os
from html import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/demo'
DATE='2026-10-29'
VERSION='1.0.0'
def para(text): return ('p',text)
def section(title): return ('h',title)
def step(title,action,speech,check):
    return [section(title),para('조작: '+action),para('설명 멘트: “'+speech+'”'),para('완료 확인: '+check)]

agenda=[['구간','권장 시간','보여드릴 내용'],['도입','00:00-00:45','목적과 자료 기준'],['지도 표시','00:45-04:30','월·지도 항목·연간 제어 잠금'],['레이어 해석','04:30-08:30','등수두선·수위 저하 격자'],['지점 분석','08:30-12:30','경보 지점·상세 정보·선택 해제'],['월별 비교','12:30-15:30','12개월 비교·월별 재생'],['출력과 마무리','15:30-18:00','SHP 저장·출력 옵션·요약'],['지연 대응','18:00-20:00','최대 2분 여유']]

script_pages=[
('최종 시연대본',[
 para('유구천 유역 지하수 모니터링 | Agriculture 2026 | v1.0.0'),
 para('지도 조회 → 레이어 해석 → 지점 분석 → 비교·내보내기 순서로 진행합니다. 본 진행은 18분, 지연 대응은 2분으로 계획합니다. 아래 시간은 권장 배정이며 사람의 발표 시간을 실측한 결과가 아닙니다.'),
 section('시작 전 준비'),
 para('새 작업 폴더에서 npm ci → npm test → npm run build를 실행합니다. npm run preview -- --host 127.0.0.1 --port 4173 --strictPort로 확인용 서버를 실행하고 http://127.0.0.1:4173/에 접속합니다. 운영 주소를 사용한다면 먼저 같은 버전인지 확인합니다.'),
 para('데이터 로딩이 끝난 뒤 넓은 PC 화면에서 2025년 5월, 연평균 대비 편차, 약 50m 원본 격자 켜짐을 확인합니다. 보조 레이어는 모두 끄고 지점 선택은 해제합니다. 원본 수위 JSON은 설치 시 자동 복원됩니다.'),
 para('Vworld 키가 없으면 OpenStreetMap 일반 배경이 정상입니다. 실제 배경지도·다운로드가 필요한 시연에서는 외부 통신과 저장 폴더를 미리 확인합니다. GPS 권한을 요청하는 조작은 본 대본에서 제외합니다.'),
 ('table',agenda),
 section('00:00-00:45 도입'),
 para('“2025년 월말 지하수위를 지도와 그래프로 비교하고, 관심 지점을 조회한 뒤 GIS 파일로 활용하는 흐름을 보여드리겠습니다. 자료는 MODFLOW 6 계산 결과이고, 예시 수위 저하 지수와 경보는 참고 기준입니다.”'),
]),
('월 선택과 지도 표시',
 step('00:45-01:45 자료 기준과 화면 구성',
 '연도·월 아래의 ‘자료 기준: 2025년 월말 수위’와 산정 방식을 가리킵니다. 왼쪽 시점·레이어, 중앙 지도, 오른쪽 상세 정보·경보 영역을 설명합니다. 지도 오른쪽 위 ‘유역 전체 영역 맞춤’을 누릅니다.',
 '전체 격자 영역을 화면 크기에 맞춰 보여드립니다. 배경지도가 아니라 색상이 있는 수위 격자가 분석 대상입니다.',
 '격자 유역 전체가 보이며 지점은 미선택 상태입니다.')+
 step('01:45-03:00 월과 지표 전환',
 '5월을 기준으로 ‘수위 지도 표시’를 연평균 대비 편차 → 전월 대비 변화량 → 수위 표고 순서로 바꿉니다. 각 항목의 지도 설명, 범례 이름과 단위를 함께 보여드립니다. 계절별 퀵 필터는 ‘5월 (갈수기)’를 한 번 사용합니다.',
 '편차는 같은 격자의 12개월 월말 평균과의 차이, 변화량은 직전 월과의 차이입니다. 수위 표고는 선택 월 수위 자체이며 편차·변화량과 단위가 다릅니다.',
 '편차·변화량은 cm, 수위 표고는 m이며 선택 항목에 맞춰 설명이 바뀝니다.')+
 step('03:00-04:30 연간 변동 폭과 제어 잠금',
 '‘연간 변동 폭’을 선택하고 월 선택, 재생, 계절별 퀵 필터가 비활성화된 것을 보여드립니다. 이후 ‘수위 표고’로 복귀하고 5월을 확인합니다.',
 '연간 변동 폭은 1~12월 최고수위와 최저수위의 차이입니다. 같은 연도에서는 월별로 달라지지 않아 월 조작을 잠급니다.',
 '연간 항목에서는 월 선택이 ‘1~12월 전체’이며 복귀 후 월·재생·계절 필터를 다시 사용할 수 있습니다.')
),
('등수두선과 수위 저하 격자',
 step('04:30-05:45 월별 등수두선',
 '수위 표고·5월 상태에서 ‘지하수위 등수두선’을 켭니다. ‘등수두선 표시 간격’을 10m에서 5m로 바꾸고 선과 표고 표기를 보여드립니다. 지도 안내의 월·간격을 확인합니다.',
 '같은 월말 수위 표고를 연결한 선입니다. 5m는 10m보다 표시 간격이 촘촘합니다. 별도 유동 화살표나 공식 유동 해석 결과를 뜻하지는 않습니다.',
 '‘2025년 5월 등수두선 · 5m 간격’ 안내가 보입니다. 등수두선은 수위 표고에서만 표시합니다.')+
 step('05:45-07:00 저하 격자 단독 표시',
 '등수두선을 끕니다. 수위 표고 상태에서 ‘예시 수위 저하 격자’를 켜고 ‘약 50m 원본 격자’를 끕니다. ‘수위 저하 표시 범위’는 자동 또는 전체 격자로 확인합니다. ‘4단계 (예시 지수)’와 ‘실제 저하량 (cm)’을 차례로 보여드립니다.',
 '수위 저하량은 연내 최고수위에서 현재 월 수위를 뺀 값입니다. 4단계는 이 값을 max(5m, 연간 변동 폭)로 나눈 예시 지수입니다.',
 '하단 지도 안내에 연내 최고 대비 저하 지도와 전체 격자 표시가 나타납니다. 지도 표시 항목과 저하 지도 항목을 혼동하지 않습니다.')+
 step('07:00-08:30 겹침 표시와 해석 범위',
 '약 50m 원본 격자를 다시 켜고 저하 레이어가 겹침 강조로 바뀌는 것을 설명합니다. 예시 관리구역·관측정을 잠시 켜서 보조 정보임을 안내한 뒤 끕니다. 마지막에는 저하 레이어를 끄고 수위 표고·5월로 정리합니다.',
 '겹쳐 볼 때는 지수 35% 이상 구역을 강조할 수 있습니다. 낮은 단계가 강조되지 않는 것을 자료 없음으로 해석하지 않습니다. 관측정과 관리구역은 예시이고 실시간 연동은 없습니다.',
 '수위 표고·원본 격자만 남습니다. 저하 지수는 공식 가뭄 단계가 아니며 지표고가 단계 산식에 포함되지 않습니다.')
),
('경보 지점과 상세 정보',
 step('08:30-10:00 5월 경보에서 지점 선택',
 '오른쪽 ‘수위 변동 경보’에서 방향을 하강만으로 바꾸거나 전체를 유지합니다. YG-R504_C279 항목을 누릅니다. 현재 자료에서는 4월 68.56m → 5월 68.21m, 변화량 약 -34.9cm가 표시됩니다.',
 '경보는 전월 대비 월말 수위 변화로 계산합니다. 이 지점은 하강 방향이며 25cm 이상, 50cm 미만의 관심 구간입니다. 목록을 누르면 지도 선택과 상세 정보가 연동됩니다.',
 '지도에 선택 표시가 있고 오른쪽에 같은 격자 ID와 현재 수위가 나타납니다. 수치는 v1.0.0 자료 기준 예시입니다.')+
 step('10:00-11:15 상세 지표와 선택 해제',
 '현재 수위, 연평균 대비 편차, 전월 변화량, 연간 변동 폭, 12개월 그래프를 순서대로 보여드립니다. 평균·추세 체크를 한 번 조작합니다. ‘선택 해제’로 지점 선택을 취소합니다. 다시 선택했다면 지도 선택 표시의 닫기 또는 Esc도 사용할 수 있습니다.',
 '한 지점의 수위 변화와 지도 지표를 함께 확인합니다. 지표고-수두는 높이 기준이 확인되지 않은 참고 차이이며 확정 지하수심이 아닙니다. 저류량은 산정 자료 없음으로 안내합니다.',
 '선택 해제 후 지도 선택 표시와 지점 상세 수치가 사라지고 미선택 안내로 돌아갑니다. 대화상자가 열려 있으면 Esc는 대화상자를 먼저 닫습니다.')+
 step('11:15-12:30 1월 경보 예외',
 '월을 1월로 바꾸고 지도 갱신이 끝날 때까지 기다립니다. 오른쪽 경보 안내에서 전년도 12월 자료가 없어 전월 비교를 산정할 수 없음을 확인합니다. 이후 5월로 복귀합니다.',
 '1월의 경보 미산정은 자료 범위에 따른 예외입니다. 이전 자료가 없다는 의미이며 수위 변화가 없거나 안전하다는 판정은 아닙니다.',
 '2024년 12월 자료 없음 안내가 보이며 5월로 돌아오면 비교 가능한 경보 목록이 다시 나타납니다.')
),
('12개월 비교와 재생',
 step('12:30-13:45 월별 비교 화면',
 '‘12개월 비교’를 누릅니다. 계산이 끝나 12개 카드가 나타나면 ‘12개월 비교 항목’을 연평균 대비 편차와 수위 표고로 바꿔 보여드립니다. 같은 색상 범위에서 월별 차이를 설명합니다.',
 '배경지도와 보조 레이어를 제외해 월별 수위의 색상 차이를 비교합니다. 카드 수치는 비교 가능한 격자의 단순 평균이며 유역 저류량을 뜻하지 않습니다.',
 '1월부터 12월까지 카드가 있으며 계산 중일 때는 반복 클릭하지 않습니다.')+
 step('13:45-14:30 비교 카드에서 지도 복귀',
 '5월 카드의 ‘5월 지도에서 보기’를 누릅니다. 본 지도에 5월과 선택 비교 항목이 반영되는지 확인합니다. 닫기 버튼으로 나가면 현재 선택을 유지할 수도 있습니다.',
 '비교에서 관심 월을 골라 본 지도와 지점 분석으로 이어갈 수 있습니다.',
 '비교 대화상자가 닫히고 왼쪽 월과 지도 표시가 선택한 카드의 기준에 맞습니다.')+
 step('14:30-15:30 월별 재생과 출력 준비',
 '‘재생’을 누르고 월과 지도가 함께 바뀌는 것을 두세 번 확인한 뒤 ‘정지’를 누릅니다. 5월을 다시 선택하고 지도 갱신이 완료되면 ‘수위 표고’로 맞춥니다. 지점 선택이 있으면 해제합니다.',
 '월별 수위를 차례로 확인할 수 있습니다. 출력은 현재 선택한 월을 기준으로 하므로 재생을 멈추고 월을 다시 확인합니다.',
 '재생이 멈췄고 월 선택은 5월입니다. 시간 조작은 연간 변동 폭이 아닌 월별 표시 항목에서 진행합니다.')
),
('파일 내보내기와 마무리',
 step('15:30-16:30 SHP 다운로드',
 '상단 ‘내보내기’를 누릅니다. ESRI SHP → 표시 격자 중심점 → EPSG:5179 → 현재 선택 월(05월)을 확인하고 ‘다운로드’를 한 번 누릅니다. 브라우저 다운로드 목록에서 ZIP의 실제 저장 완료를 확인합니다.',
 '화면의 원본 격자와 수위를 GIS에서 활용할 수 있는 SHP 패키지로 내보냅니다. 이 출력은 선택한 한 점만이 아니라 유역의 유효 격자를 대상으로 합니다.',
 'ZIP에 shp·shx·dbf·prj·cpg와 metadata.json이 포함됩니다. 생성 중에는 기다리고 실패 안내나 미완료 다운로드를 완료로 소개하지 않습니다.')+
 step('16:30-17:30 다른 형식과 출력 범위',
 '내보내기를 다시 열어 GeoJSON의 좌표계가 WGS84 경위도로 고정됨을 보여드립니다. AutoCAD DXF를 선택해 현재 월 고정과 격자·수위 텍스트·등수두선 옵션을 설명합니다. 추가 다운로드는 생략하고 취소로 닫습니다.',
 'SHP는 형상과 좌표계를 고를 수 있고 GeoJSON은 웹 표준 경위도, DXF는 현재 월 도면을 출력합니다. 연간 지도를 보더라도 내보내기는 마지막 선택 월을 기준으로 하므로 월을 먼저 확인합니다.',
 '실제 저장은 SHP 한 건으로 확인하고 다른 형식은 옵션 설명으로 구분합니다. 외부 GIS·CAD에서의 재개방 검수는 별도입니다.')+
 step('17:30-18:00 마무리',
 '시점 조회, 지도 항목·레이어 전환, 지점 분석, 비교와 파일 활용을 한 문장씩 정리합니다. 새 입력이나 반복 재생을 시작하지 않습니다.',
 '월말 수위를 같은 기준으로 비교하고 관심 지점을 확인한 뒤 GIS 파일로 활용했습니다. 예시 지수와 계산 자료의 기준을 함께 확인하는 것이 중요합니다.',
 '지도는 수위 표고·5월, 재생 정지, 지점 미선택 상태로 정리합니다.')+
 [section('18:00-20:00 지연·오류 대응'),para('초기 로딩·비교 계산·파일 생성이 늦으면 한 번 실행한 작업을 기다리고 설명을 줄입니다. 파일 저장이 미완료이면 그 상태를 밝힙니다. 비교 대화상자는 닫기 또는 Esc로 닫고, 잘못 이동한 지도는 유역 전체 영역 맞춤으로 복귀합니다. 19분 30초부터 요약해 20분 안에 마칩니다. 이 대본은 시연 안내이며 운영 인수 승인 결과서가 아닙니다.')]
),
]

quick_rows=[['권장 시각','필수 조작','완료 확인'],
 ['00:00','자료 기준과 산정 방식 안내. 5월·연평균 대비 편차·원본 격자 켜짐, 나머지 레이어 꺼짐.','재생 정지·지점 미선택. 초기 자료 로딩 완료.'],
 ['00:45','유역 전체 영역 맞춤 → 5월 (갈수기). 지도 표시를 편차 → 전월 변화량 → 수위 표고로 변경.','선택 지표에 맞는 지도 설명·범례·단위.'],
 ['03:00','연간 변동 폭 선택 → 월·재생·계절 필터 잠금 설명 → 수위 표고·5월 복귀.','연간 선택은 1~12월 전체, 복귀 후 월 제어 가능.'],
 ['04:30','등수두선 켜기 → 간격 10m → 5m.','5월·5m 간격 지도 안내와 선 표시.'],
 ['05:45','등수두선 끄기 → 저하 격자 켜기 → 원본 격자 끄기 → 단계/실제 저하량.','단독 전체 격자 표시. 공식 가뭄 판정 아님.'],
 ['07:00','원본 격자 다시 켜 겹침 설명 → 예시 관리구역·관측정 잠시 표시 후 끄기 → 저하 격자 끄기.','수위 표고·5월 원본 격자만 남김.'],
 ['08:30','경보 YG-R504_C279 선택 → 상세 수위·그래프 확인 → 선택 해제.','68.21m / 전월 약 -34.9cm. 해제 후 미선택 안내.'],
 ['11:15','1월 선택 → 경보 미산정 안내 → 5월 복귀.','2024년 12월 자료 없음. 안전 판정과 구분.'],
 ['12:30','12개월 비교 → 지표 전환 → 5월 카드에서 지도 보기.','12개 카드, 복귀 후 월·지도 항목 반영.'],
 ['14:30','재생으로 두세 월 확인 → 정지 → 5월·수위 표고로 복귀.','출력할 월과 재생 정지 상태 확인.'],
 ['15:30','내보내기 → ESRI SHP·중심점·EPSG:5179·현재 월 → 다운로드 한 번.','브라우저에서 ZIP 실제 저장 완료 확인.'],
 ['16:30','GeoJSON·DXF 옵션 설명 후 취소 → 17:30 요약.','추가 형식은 설명과 실제 저장을 구분. 18:00 종료 목표.']]

quick_pages=[('최종 조작표',[
 para('유구천 유역 지하수 모니터링 | v1.0.0 | 본 진행 18분 + 여유 2분'),
 para('시작: 2025년 5월 / 연평균 대비 편차 / 원본 격자 켜짐 / 보조 레이어 꺼짐 / 재생 정지 / 지점 미선택. 시간은 권장 배정이며 실측값이 아닙니다.'),
 ('table',quick_rows),
]),('입력 기준과 복구 요령',[
 section('발표 전 확인'),
 para('npm ci → npm test → npm run build → npm run preview -- --host 127.0.0.1 --port 4173 --strictPort. 접속 주소는 http://127.0.0.1:4173/입니다. 데이터 로딩과 지도 표시 완료 뒤 시작합니다. Vworld 키가 없으면 OpenStreetMap 일반 지도가 정상입니다.'),
 section('설명할 계산 기준'),
 ('table',[['항목','발표 시 설명'],['수위 자료','2025년 1~12월 월말 수위 / MODFLOW 6 계산 결과.'],['편차·변화량','편차: 동일 격자의 12개월 월말 평균 대비. 변화량: 직전 월 대비. 단위 cm.'],['연간 변동 폭','연내 최고-최저 수위. 월·재생·계절별 퀵 필터 비활성화.'],['등수두선','같은 월 수위 표고를 연결. 수위 표고 모드에서만 표시.'],['수위 저하 지수','(연내 최고-선택 월) / max(5m, 연간 변동 폭). 35·55·75% 경계의 예시 단계.'],['참고 경보','전월 변화 절댓값 25~<50cm 관심, 50~<100cm 주의, 100cm 이상 중점 검토.'],['해석 제한','예시 지수는 공식 가뭄 판정 아님. DEM 차이는 확정 지하수심 아님. 저류량은 산정 자료 없음.']]),
 section('빠른 복구'),
 para('지도가 멀어졌다면 유역 전체 영역 맞춤. 월이 잠겨 있으면 원본 격자의 지도 표시를 연간 변동 폭에서 수위 표고로 변경. 등수두선이 잠겨 있으면 수위 표고로 변경. 저하 격자만 볼 때는 수위 표고에서 저하 레이어를 켜고 원본 격자를 끕니다.'),
 para('선택 해제는 오른쪽 선택 해제, 지도 선택 표시 닫기 또는 Esc. 대화상자가 열려 있으면 Esc는 대화상자를 먼저 닫습니다. 1월 경보 없음은 전년도 12월 자료 부재에 따른 정상 예외입니다.'),
 section('파일 저장과 지연 대응'),
 para('출력 전에 재생을 멈추고 5월을 확인합니다. SHP는 중심점·EPSG:5179·현재 월로 한 건 저장합니다. 전체 유효 격자가 대상이며 선택 지점만 출력하는 기능은 아닙니다. 저장된 ZIP의 shp·shx·dbf·prj·cpg·metadata.json을 확인합니다.'),
 para('GeoJSON은 EPSG:4326 고정, DXF는 현재 월 고정입니다. 파일 생성 중 반복 클릭하지 않고 브라우저의 실제 저장 완료를 확인합니다. 30초 이상 지연되면 설명을 줄이고, 해결되지 않으면 미완료 상태를 밝힙니다. 19:30부터 요약해 20:00 안에 마칩니다.'),
])]

def as_markdown(pages):
    chunks=[f'<!-- Agriculture 2026 v{VERSION}; 기준일 {DATE}; 편집 원본 -->']
    for i,(title,blocks) in enumerate(pages):
        if i:chunks.append('<!-- pagebreak -->')
        chunks.append('# '+title)
        for kind,value in blocks:
            if kind=='h': chunks.append('## '+value)
            elif kind=='p':chunks.append(value)
            else:
                chunks.append('| '+' | '.join(value[0])+' |\n| '+' | '.join('---' for _ in value[0])+' |\n'+'\n'.join('| '+' | '.join(row)+' |' for row in value[1:]))
    return '\n\n'.join(chunks)+'\n'

def from_markdown(text):
    pages=[]
    for chunk in text.split('<!-- pagebreak -->'):
        title=None;blocks=[];paragraph=[];table=[]
        def flush():
            if paragraph:blocks.append(para(' '.join(paragraph)));paragraph.clear()
            if table:blocks.append(('table',table.copy()));table.clear()
        for line in chunk.splitlines():
            line=line.strip()
            if line.startswith('<!--'):continue
            if not line:flush();continue
            if line.startswith('# '):flush();title=line[2:];continue
            if line.startswith('## '):flush();blocks.append(section(line[3:]));continue
            if line.startswith('|') and line.endswith('|'):
                if paragraph:flush()
                cells=[s.strip() for s in line[1:-1].split('|')]
                if not all(set(c)<=set('-: ') for c in cells):table.append(cells)
            else:
                if table:flush()
                paragraph.append(line)
        flush()
        if title:pages.append((title,blocks))
    if not pages:raise ValueError('Markdown에 페이지 제목이 없습니다.')
    return pages

def render_pdf(dest,pages,quick=False):
    w,h=A4
    body=ParagraphStyle('Body',fontName='Korean',fontSize=9.8 if quick else 10.5,leading=14.3 if quick else 16.3,spaceAfter=8,wordWrap='CJK',textColor=colors.HexColor('#17212d'))
    title=ParagraphStyle('Title',parent=body,fontName='KoreanBold',fontSize=21,leading=29,spaceAfter=14,textColor=colors.black)
    sub=ParagraphStyle('Section',parent=body,fontName='KoreanBold',fontSize=12,leading=18,spaceBefore=8,spaceAfter=7,textColor=colors.black)
    cell=ParagraphStyle('Cell',parent=body,fontSize=8.8 if quick else 9.4,leading=12.8 if quick else 14.2,spaceAfter=0)
    head=ParagraphStyle('CellHead',parent=cell,fontName='KoreanBold',textColor=colors.HexColor('#152d42'))
    story=[]
    for pi,(name,blocks) in enumerate(pages):
        if pi:story.append(PageBreak())
        story.append(Paragraph(escape(name),title))
        for kind,value in blocks:
            if kind=='h':story.append(Paragraph(escape(value),sub))
            elif kind=='p':story.append(Paragraph(escape(value),body))
            else:
                widths=[64,244,195] if quick and pi==0 else ([90,413] if len(value[0])==2 else [85,110,308])
                content=[[Paragraph(escape(str(v)),head if ri==0 else cell) for v in row] for ri,row in enumerate(value)]
                table=Table(content,colWidths=widths,repeatRows=1,hAlign='LEFT')
                table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e8eef3')),('GRID',(0,0),(-1,-1),.5,colors.HexColor('#cdd5dd')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
                story.extend([table,Spacer(1,10)])
    def footer(c,d):
        c.saveState();c.setFont('Korean',8);c.setFillColor(colors.HexColor('#566579'))
        c.drawString(46,h-30,f'AGRICULTURE 2026  |  v{VERSION}  |  시연 안내')
        c.setStrokeColor(colors.HexColor('#ccd4dc'));c.line(46,39,w-46,39)
        c.drawString(46,26,'기준일 '+DATE+'  |  2025년 월말 수위')
        c.drawRightString(w-46,26,f'{d.page} / {len(pages)}');c.restoreState()
    doc=SimpleDocTemplate(str(dest),pagesize=A4,rightMargin=46,leftMargin=46,topMargin=48,bottomMargin=49,title=pages[0][0]+' - Agriculture 2026 v'+VERSION,author='Agriculture 2026',subject='유구천 유역 지하수 모니터링 시연 안내',pageCompression=1)
    doc.build(story,onFirstPage=footer,onLaterPages=footer)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font',default=os.environ.get('DEMO_FONT','C:/Windows/Fonts/malgun.ttf'))
    parser.add_argument('--bold-font',default=os.environ.get('DEMO_BOLD_FONT','C:/Windows/Fonts/malgunbd.ttf'))
    parser.add_argument('--reset-source',action='store_true',help='명시한 경우에만 Markdown을 코드의 초기 대본으로 되돌립니다.')
    args=parser.parse_args()
    for f in [args.font,args.bold_font]:
        if not Path(f).is_file():parser.error('한글 TrueType 글꼴 경로를 --font 및 --bold-font로 지정하세요.')
    assert (ROOT/'VERSION').read_text().strip()==VERSION
    pdfmetrics.registerFont(TTFont('Korean',args.font));pdfmetrics.registerFont(TTFont('KoreanBold',args.bold_font))
    OUT.mkdir(parents=True,exist_ok=True)
    for name,pages,quick in [('최종_시연대본',script_pages,False),('최종_조작표',quick_pages,True)]:
        markdown=OUT/(name+'.md')
        if not markdown.exists() or args.reset_source:markdown.write_text(as_markdown(pages),encoding='utf-8')
        pages=from_markdown(markdown.read_text(encoding='utf-8'))
        render_pdf(OUT/(name+'.pdf'),pages,quick)
    print(json.dumps({'version':VERSION,'scriptPages':len(script_pages),'quickReferencePages':len(quick_pages)},ensure_ascii=False))

if __name__=='__main__':main()
