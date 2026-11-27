"use client";

import { useActionState } from "react";
import { saveCompany, type FormState } from "@/app/(app)/company/actions";
import { Field, FormMessage, Select, TextArea, TextInput } from "@/components/form/fields";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";
import { BIZ_TYPE_LABEL, REGIONS } from "@/lib/company";

export type CompanyValues = {
  name: string;
  industryLabel: string;
  foundedAt: string; // YYYY-MM-DD (KST)
  region: string;
  bizType: string;
  ksicCodes: string;
  certifications: string;
  headcount: string;
  revenueBand: string;
  ceoBirthYear: string;
  description: string;
  address: string;
  ceoName: string;
  contactName: string;
  contactDept: string;
  contactTitle: string;
  contactPhone: string;
  contactTel: string;
  contactEmail: string;
};

export function CompanyForm({ values }: { values: CompanyValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCompany, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} onSubmit={submitWith(action)} className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6 md:p-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="법인명" name="name" error={e.name}>
          <TextInput name="name" defaultValue={values.name} required invalid={!!e.name} />
        </Field>
        <Field label="한 줄 분류" name="industryLabel" help="사이드바에 보이는 짧은 분류 (예: SW 스타트업)" error={e.industryLabel}>
          <TextInput name="industryLabel" defaultValue={values.industryLabel} />
        </Field>
        <Field label="설립일" name="foundedAt" help="업력은 이 날짜로 자동 계산해요" error={e.foundedAt}>
          <TextInput name="foundedAt" type="date" defaultValue={values.foundedAt} invalid={!!e.foundedAt} />
        </Field>
        <Field label="소재지" name="region" error={e.region}>
          <Select name="region" defaultValue={values.region} options={REGIONS.map((r) => ({ value: r, label: r }))} />
        </Field>
        <Field label="사업자 유형" name="bizType" error={e.bizType}>
          <Select
            name="bizType"
            defaultValue={values.bizType}
            options={Object.entries(BIZ_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="인원" name="headcount" help="대표 포함 상시 인원" error={e.headcount}>
          <TextInput name="headcount" inputMode="numeric" defaultValue={values.headcount} invalid={!!e.headcount} />
        </Field>
        <Field label="업종 코드(KSIC)" name="ksicCodes" help="쉼표로 여러 개 (예: 58222, 62010)" error={e.ksicCodes}>
          <TextInput name="ksicCodes" defaultValue={values.ksicCodes} />
        </Field>
        <Field label="보유 인증·특허" name="certifications" help="쉼표로 여러 개 (예: 벤처기업, 기업부설연구소)" error={e.certifications}>
          <TextInput name="certifications" defaultValue={values.certifications} />
        </Field>
        <Field label="매출 구간" name="revenueBand" help="예: 매출 없음, 1억 미만" error={e.revenueBand}>
          <TextInput name="revenueBand" defaultValue={values.revenueBand} />
        </Field>
        <Field label="대표자 출생 연도" name="ceoBirthYear" help="청년 창업 요건 판단에 써요" error={e.ceoBirthYear}>
          <TextInput name="ceoBirthYear" inputMode="numeric" defaultValue={values.ceoBirthYear} invalid={!!e.ceoBirthYear} />
        </Field>
        <Field label="주력 사업 설명" name="description" help="무엇을 누구에게 제공하는지 한 문단으로" error={e.description} wide>
          <TextArea name="description" defaultValue={values.description} rows={5} />
        </Field>
      </div>
      <div className="flex flex-col gap-1 border-t border-line pt-6">
        <h2 className="m-0 text-[17px] leading-[1.45] font-bold">신청서 인적사항</h2>
        <p className="m-0 text-[14px] leading-[1.6] text-ink-3">참여의향서·신청서 양식의 성명·연락처·주소 칸을 채울 때 써요. 비워 두면 그 칸은 비워 둔 채로 확인 필요로 남겨요.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="본사 주소" name="address" help="신청서 '기업주소' 칸에 그대로 써요" error={e.address} wide>
          <TextInput name="address" defaultValue={values.address} invalid={!!e.address} />
        </Field>
        <Field label="대표자 이름" name="ceoName" error={e.ceoName}>
          <TextInput name="ceoName" defaultValue={values.ceoName} invalid={!!e.ceoName} />
        </Field>
        <Field label="신청 담당자 이름" name="contactName" help="신청서 '성명' 칸" error={e.contactName}>
          <TextInput name="contactName" defaultValue={values.contactName} invalid={!!e.contactName} />
        </Field>
        <Field label="담당자 부서" name="contactDept" error={e.contactDept}>
          <TextInput name="contactDept" defaultValue={values.contactDept} invalid={!!e.contactDept} />
        </Field>
        <Field label="담당자 직위" name="contactTitle" error={e.contactTitle}>
          <TextInput name="contactTitle" defaultValue={values.contactTitle} invalid={!!e.contactTitle} />
        </Field>
        <Field label="담당자 휴대전화" name="contactPhone" error={e.contactPhone}>
          <TextInput name="contactPhone" inputMode="tel" defaultValue={values.contactPhone} invalid={!!e.contactPhone} />
        </Field>
        <Field label="사무실 전화" name="contactTel" error={e.contactTel}>
          <TextInput name="contactTel" inputMode="tel" defaultValue={values.contactTel} invalid={!!e.contactTel} />
        </Field>
        <Field label="담당자 이메일" name="contactEmail" error={e.contactEmail}>
          <TextInput name="contactEmail" type="email" defaultValue={values.contactEmail} invalid={!!e.contactEmail} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full md:w-auto")}>
          {pending ? "저장하는 중" : "기본 정보 저장하기"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
