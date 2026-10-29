# 시연 자료

Agriculture 2026 v1.0.0의 유구천 유역 지하수 모니터링 화면을 기준으로 작성했습니다.

| 문서 | 읽기·인쇄용 | 편집 원본 |
| --- | --- | --- |
| 최종 시연대본 | [PDF 6쪽](최종_시연대본.pdf) | [Markdown](최종_시연대본.md) |
| 최종 조작표 | [PDF 2쪽](최종_조작표.pdf) | [Markdown](최종_조작표.md) |

본 진행은 18분, 지연 대응은 2분으로 계획했습니다. 배정 시간은 권장안이며 사람의 음성 발표 시간을 실측한 기록이 아닙니다. 버튼명과 주요 동작은 해당 버전의 실제 화면에서 확인했습니다. 전체 발표 실측과 발주처 운영 인수 검수는 별도입니다.

초기 상태는 2025년 5월, 연평균 대비 편차, 원본 격자 켜짐, 보조 레이어 꺼짐, 재생 정지, 지점 미선택입니다. 5월 수치 예시는 이 버전의 실행 자료를 기준으로 합니다.

## 수정과 PDF 재생성

Markdown을 수정한 뒤 아래 선택 도구로 PDF를 다시 생성합니다. 앱 실행에는 Python이나 PDF 생성 도구가 필요하지 않습니다.

```sh
python -m pip install -r docs/demo/requirements.txt
python scripts/build-demo-docs.py
```

Windows에서는 설치된 맑은 고딕을 기본 사용합니다. 다른 환경에서는 임베딩이 허용된 한글 TrueType 글꼴을 준비해 지정합니다. 글꼴 파일 자체는 저장소에 포함하지 않습니다.

```sh
python scripts/build-demo-docs.py --font /path/Korean-Regular.ttf --bold-font /path/Korean-Bold.ttf
```

`<!-- pagebreak -->`는 페이지 구분입니다. PDF 생성 후 페이지 수, 표 잘림과 한글 표시를 다시 확인합니다. `--reset-source`는 Markdown을 초기 대본으로 되돌리므로 기존 편집을 보존하려면 사용하지 않습니다.
