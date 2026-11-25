# 기업마당 지원사업정보 API — 확인된 명세

- 확인일: 2026-11-23, 출처: https://www.bizinfo.go.kr/apiDetail.do?id=bizinfoApi (사이트 > 활용정보 > 정책정보 개방 > 지원사업정보 API. 수정일 2025.10.22)
- URL: `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do`, **GET**, JSON/XML
- 키 없이 호출하면 RSS XML에 `<reqErr>인증키를 입력해주세요.</reqErr>` (실제 호출로 확인)
- 틀린 키로 dataType=json 호출하면 JSON `{"reqErr":"존재하지 않는 인증키 입니다."}` (2026-11-26 실제 호출로 확인) → `SourceError`로 그대로 보여 준다
- **마감되지 않은 공고만 제공**한다 (페이지 안내 문구)

## 요청 파라미터
| 이름 | 필수 | 설명 |
|---|---|---|
| crtfcKey | Y | 서비스 인증키 |
| dataType | N | `rss`(XML) / `json` |
| searchCnt | N | 조회건수. 0 또는 없음 = 전체 |
| searchLclasId | N | 분야: 01 금융, 02 기술, 03 인력, 04 수출, 05 내수, 06 창업, 07 경영, 09 기타 |
| hashtags | N | 쉼표로 여러 개 (분야명, 지역명: 서울, 부산, …) |
| pageUnit | N | 한 페이지 개수 |
| pageIndex | N | 페이지 번호 |

## JSON 응답 항목 (명세 표 기준)
| 필드 | 뜻 | 예시 |
|---|---|---|
| pblancId | 공고ID | PBLN_000000000080236 |
| pblancNm | 공고명 | |
| pblancUrl | 공고URL | |
| jrsdInsttNm | 소관기관명 | 중소벤처기업부 |
| excInsttNm | 수행기관명 | 지방중소벤처기업청 |
| bsnsSumryCn | 사업개요내용 (HTML 포함 가능) | |
| reqstMthPapersCn | 사업신청방법 | |
| refrncNm | 문의처 | |
| rceptEngnHmpgUrl | 사업신청URL | |
| pldirSportRealmLclasCodeNm | 지원분야 대분류 | 경영 |
| creatPnttm | 등록일자 | `2022-09-02 15:38:29` |
| reqstBeginEndDe | 신청기간 | `20220727 ~ 20220930` |
| trgetNm | 지원대상 | 중소기업 |
| hashTags | 해시태그 (쉼표 구분) | `2022,금융,충북,대전,중소벤처기업부` |
| inqireCo | 조회수 | |
| flpthNm / fileNm | 첨부파일 경로 / 이름 | |
| printFlpthNm / printFileNm | 본문출력파일 경로 / 이름 | |
| totCnt | 전체건수 | 1435 |

## 아직 확인 못 한 것 (실제 응답으로 확인 → `fixtures/bizinfo/`)
- JSON 최상위 구조(배열을 감싸는 키 이름). 파서는 객체 배열을 찾아 쓰도록 해 두었다
- 신청기간이 "상시", "예산 소진 시" 같은 문자열로 오는 경우의 형식
- 첨부파일이 여러 개일 때 flpthNm/fileNm 구분자
