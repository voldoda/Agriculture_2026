# 두 GitHub 저장소의 동기화

기준 저장소는 [WeSmart-co-op/Agriculture](https://github.com/WeSmart-co-op/Agriculture)이며, [voldoda/Agriculture_2026](https://github.com/voldoda/Agriculture_2026)에 같은 소스와 문서를 함께 반영합니다. 두 저장소의 `main`은 같은 커밋을 가리키도록 관리합니다. 이 문서는 2026-10-29에 요청한 이후 업데이트 원칙을 기록합니다.

## 원격 설정

한 번만 아래와 같이 설정합니다. 새 작업 폴더를 만들 때에는 기준 저장소를 복제합니다. 두 계정의 쓰기 권한이 필요합니다.

```sh
git clone https://github.com/WeSmart-co-op/Agriculture.git
cd Agriculture
git remote add mirror https://github.com/voldoda/Agriculture_2026.git
git remote set-url --add --push origin https://github.com/WeSmart-co-op/Agriculture.git
git remote set-url --add --push origin https://github.com/voldoda/Agriculture_2026.git
git config push.followTags true
git config push.default simple
```

기존 작업 폴더에서는 먼저 `git remote -v`로 확인합니다. 위 명령을 반복하여 같은 push URL을 중복 추가하지 않습니다. 이 PC에서는 저장된 인증 계정을 구분하기 위해 원격 URL에 `aLCWa@`와 `voldoda@` 사용자 이름을 사용할 수 있습니다. 비밀번호나 토큰은 URL에 넣지 않습니다.

`origin`의 fetch 주소는 기준 저장소 한 개이고, push 주소는 두 개입니다. 일반 `git push`도 두 주소로 전송합니다. 다만 사전 점검과 결과 확인을 포함하려면 아래 명령을 사용합니다.

## 업데이트 순서

1. `git fetch origin`과 `git fetch mirror`로 양쪽 최신 상태를 확인합니다.
2. 양쪽 변경을 확인하여 로컬 `main`에 합칩니다. 프로그램 소스 충돌은 기준 저장소를 우선하고, 합의된 문서와 개선 사항은 보존합니다.
3. 변경에 맞는 자동 테스트와 빌드를 수행하고 커밋합니다. 새 버전을 확정할 때에만 버전 정보와 주석 있는 태그를 추가합니다.
4. 아래 시험 전송을 통과한 뒤 두 저장소에 게시합니다.

```sh
npm run publish:repos -- --dry-run
npm run publish:repos
```

게시 도구는 `main`과 깨끗한 작업 트리, 기준 fetch 주소와 두 push 주소를 확인합니다. 두 원격의 커밋이 현재 이력에 포함되는지, 이미 존재하는 태그가 같은 객체인지 먼저 검사합니다. 한쪽에 독립적인 변경이 있으면 어느 쪽에도 전송하기 전에 중단합니다. 전송 후 두 `main`과 현재 이력에 포함된 주석 태그를 다시 확인합니다. Git 실행 파일이 PATH에 없다면 `GIT_EXECUTABLE` 환경변수에 경로를 지정합니다.

## 일부만 성공했을 때

두 서버 사이의 전송은 하나의 트랜잭션이 아닙니다. 첫 저장소 성공 뒤 두 번째의 인증·통신이 실패할 수 있습니다. 오류가 나면 양쪽 ref를 확인하고 원인을 해결한 뒤 같은 게시 명령을 다시 실행합니다. 성공한 저장소의 기존 내용은 그대로 유지하고 나머지를 따라잡습니다. 강제 전송이나 태그 덮어쓰기로 해결하지 않습니다.

## 운영 범위

2026-10-29에 전체 자동 테스트 59개와 배포 빌드가 통과했습니다. 새 통합 테스트는 두 임시 저장소·주석 태그의 동기화, 시험 전송의 무변경, 미커밋 변경과 잘못된 주소 설정의 차단, 두 번째 저장소가 분기했을 때 첫 저장소 전송 전 차단, 이력 병합 후 재전송을 확인합니다.

이 설정은 이 작업 폴더에서 수행하는 Git 업데이트에 적용됩니다. GitHub 웹 편집이나 다른 PC의 단독 push가 두 저장소에 자동 복제되지는 않습니다. 다른 작업 폴더에서도 같은 원격 설정과 게시 명령을 적용합니다. 새 개인 토큰이나 서버 간 접근 권한을 추가하는 GitHub 자동 복제 작업은 구성하지 않았습니다.

기준 저장소는 비공개이고 동기화 대상은 공개입니다. 현재 프로그램과 문서는 사용자가 지정한 두 저장소에 반영하며, 향후 추가되는 비밀키·개인정보·공개 대상이 아닌 원자료는 제외합니다.
