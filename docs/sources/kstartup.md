# K-Startup 지원사업 공고 API (공공데이터포털 15125364) — 확인된 명세

- 확인일: 2026-11-23, 출처: https://www.data.go.kr/data/15125364/openapi.do (페이지 내장 swagger)
- URL: `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01`, **GET**
- 인증: `serviceKey` (공공데이터포털 활용신청)
- 응답 형식: `returnType=json|xml` (기본 xml)

## 요청 파라미터
`serviceKey`(필수), `page`, `perPage`, `returnType`, 그리고 필터:
`cond[intg_pbanc_yn::EQ]`, `cond[intg_pbanc_biz_nm::LIKE]`, `cond[biz_pbanc_nm::LIKE]`, `cond[supt_biz_clsfc::LIKE]`, `cond[aply_trgt_ctnt::LIKE]`, `cond[supt_regin::LIKE]`, `cond[pbanc_rcpt_bgng_dt::GTE]`(yyyyMMdd), `cond[pbanc_rcpt_end_dt::LTE]`(yyyyMMdd), `cond[aply_trgt::LIKE]`, `cond[biz_enyy::LIKE]`, `cond[biz_trgt_age::LIKE]`, `cond[prfn_matr::LIKE]`, `cond[rcrt_prgs_yn::EQ]`(모집중 Y / 마감 N)

알려진 주의점: 지역 필터가 서버에서 적용되지 않는 사례가 있다 → 받아온 뒤 다시 거른다.

## 응답
봉투: `currentCount, data, matchCount, page, perPage, totalCount`

항목(`data[]`):
| 필드 | 뜻 |
|---|---|
| pbanc_sn | 공고일련번호 |
| biz_pbanc_nm | 지원 사업 공고 명 |
| intg_pbanc_yn / intg_pbanc_biz_nm | 통합 공고 여부 / 통합 공고 사업 명 |
| pbanc_ctnt | 공고 내용 |
| supt_biz_clsfc | 지원 분야 |
| aply_trgt / aply_trgt_ctnt | 신청 대상 / 신청 대상 내용 |
| aply_excl_trgt_ctnt | 신청제외대상내용 |
| supt_regin | 지역명 |
| pbanc_rcpt_bgng_dt / pbanc_rcpt_end_dt | 접수 시작 / 종료 (yyyyMMdd) |
| rcrt_prgs_yn | 모집진행여부 (Y/N) |
| biz_enyy | 창업 기간 |
| biz_trgt_age | 대상 연령 |
| prfn_matr | 우대 사항 |
| pbanc_ntrp_nm | 창업 지원 기관명 |
| sprv_inst | 주관 기관 |
| biz_prch_dprt_nm / prch_cnpl_no | 담당 부서 / 연락처 |
| biz_gdnc_url | 사업 안내 URL |
| biz_aply_url | 공고 상세 URL |
| detl_pg_url | 사업 신청 URL |
| aply_mthd_*_istc | 신청 방법(방문/우편/팩스/온라인/기타) 설명 |

## 아직 확인 못 한 것 (실제 응답으로 확인 → `fixtures/kstartup/`)
- swagger상 `data`가 `{ data: [...] }`로 한 번 더 감싸인 것처럼 적혀 있다. 파서는 둘 다 받는다
- 일자 필드에 시간이 붙어 오는지, `pbanc_sn`이 숫자인지 문자열인지
- `biz_aply_url`(공고 상세)과 `detl_pg_url`(사업 신청) 중 어느 쪽이 실제 공고 페이지인지
