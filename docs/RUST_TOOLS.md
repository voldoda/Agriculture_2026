# Python 보조 도구의 Rust 전환

현재 프로젝트의 Python 파일 2개를 Rust로 전환했습니다. 웹 화면과 실제 2025년 수위 자료의 처리 경로는 React·JavaScript·Node.js 구성입니다. 일반 서비스 설치·실행에는 Rust나 Python이 필요하지 않습니다.

이 전환본은 v1.0.1입니다. 시연 문서 자체의 화면 기준 버전은 기존 v1.0.0을 유지합니다.

| 기존 코드 | Rust 실행 도구 | 용도 |
| --- | --- | --- |
| `process_sample_data.py` | `process-sample-data` | 과거 5~9월 SHP에서 예시 데이터 생성 |
| `scripts/build-demo-docs.py` | `build-demo-docs` | 편집한 한글 Markdown에서 시연 PDF 생성 |

Rust 소스는 `tools/agriculture-tools/`, 고정 의존성은 `Cargo.lock`에 있습니다. Python 원본은 이전 Git 이력과 별도 로컬 보관본으로 복원할 수 있습니다.

## 빌드와 실행

[공식 rustup](https://rust-lang.org/tools/install/)으로 Rust를 설치합니다. `rust-toolchain.toml`은 검증에 사용한 1.99.1을 지정합니다. Windows에서는 Visual Studio C++ 빌드 도구와 Windows SDK가 필요하며 이 PC의 Visual Studio 2022로 확인했습니다.

```sh
npm run tools:build
npm run tools:test
```

실행 파일은 `target/release/`에 생성됩니다. Windows에서는 `.exe`이며 빌드한 파일을 실행할 때 Python이나 Cargo는 필요하지 않습니다. PDF 생성에는 한글 TTF 글꼴, 샘플 생성에는 SHP/DBF가 별도로 필요합니다. 실행 파일과 도구 설치 파일은 Git에 포함하지 않습니다.

실행 파일을 직접 사용할 때는 프로젝트 폴더에서 실행하거나 `--root /path/Agriculture`로 프로젝트 경로를 지정합니다. npm 명령은 프로젝트 경로를 자동 적용합니다.

## 시연 문서 생성

`docs/demo/최종_시연대본.md`와 `최종_조작표.md`를 수정한 뒤 실행합니다.

```sh
npm run docs:demo
npm run docs:demo -- --output-dir output/demo-preview
```

Windows에서는 맑은 고딕을 기본 사용합니다. 다른 환경은 임베딩이 허용된 한글 TTF를 지정합니다. `DEMO_FONT`, `DEMO_BOLD_FONT` 환경변수도 지원합니다.

```sh
npm run docs:demo -- --font /path/Korean-Regular.ttf --bold-font /path/Korean-Bold.ttf
```

Markdown 편집은 보존하며 `--reset-source`를 명시한 경우에만 초기 템플릿으로 되돌립니다. `<!-- pagebreak -->`로 페이지를 나누며 표는 2~3열을 지원합니다. 글꼴에 필요한 글자가 없거나 페이지 내용이 넘치면 오류로 안내하여 잘림·문자 누락을 방지합니다. 내용을 늘렸다면 페이지를 추가하고 생성 결과를 확인합니다.

## 과거 예시 데이터 생성

이 도구는 과거와 동일한 짝수 행·열의 약 100m 표출 격자, 일부 합성 월과 예시 보조 레이어를 생성합니다. `prototype_with_synthetic_examples`와 합성 항목 메타데이터를 유지합니다.

```sh
npm run sample:generate -- --sample-dir /path/01_Sample
npm run sample:generate -- --sample-dir /path/01_Sample --output output/sample-data/example.json
```

기본 출력은 `output/sample-data/groundwater_sample.json`입니다. Python 도구의 기본 출력이 현재 수위 파일과 같았던 문제를 개선하여 `src/data/groundwater_data.json` 덮어쓰기는 거부합니다. 실제 2025년 수위 갱신에는 기존 `scripts/import-2025.mjs`와 검증·묶음 생성 절차를 사용합니다.

EPSG:5179의 GRS80 정의에서 WGS84 경위도로 변환하며 f64 계산과 Python 십진 반올림 결과를 보존합니다. JSON 공백과 파일 크기는 달라질 수 있고 데이터 구조·배열 순서·수치는 동일하게 유지합니다.

## 검증 결과

- 보관된 실제 5~9월 원자료에서 Python·Rust 각각 28,269개 격자를 생성했습니다. 전체 JSON 구조·문자열·배열과 숫자 820,253개를 대조해 차이 0건을 확인했습니다.
- 시연대본 6쪽과 조작표 2쪽의 전체 페이지에서 한글·표·숫자·수식과 배치를 확인했습니다. 줄바꿈 위치와 PDF 내부 생성 정보는 기존 파일과 달라질 수 있습니다.
- Rust 테스트 8개로 반올림·좌표 원점, SHP/DBF 읽기·결측 대체, 활성 데이터 보호, Markdown 보존·초기화와 잘못된 입력 처리를 확인했습니다.
- 실제 2025년 데이터와 기존 배포용 시연 PDF는 유지합니다. 검증용 원자료·JSON·PDF·렌더 이미지는 로컬 보관 폴더에 둡니다.

이 변경은 Python 의존성을 제거한 보조 도구 전환입니다. 브라우저의 초기 전송량이나 지도 계산 속도가 개선된 변경으로 해석하지 않습니다.
