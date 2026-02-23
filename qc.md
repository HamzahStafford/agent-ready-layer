
# Smart Test Case Generator Pro --- OPENCLAW SKILL SPEC

## 1. Project Overview
**Name:** Smart Test Case Generator Pro (OpenClaw Skill)

**Purpose:** Automatically generate a structured test case suite from a Markdown product specification. 
The skill simulates senior-level QA analytical thinking, leveraging **Semantic Reasoning** to uncover hidden gaps in AI-driven or complex software systems.

---

## 2. Target Users
- QC / Test Engineer
- QA Manager / Lead
- Product Owner
- AI/ML Automation Engineer

---

## 3. Input Specification
- **Input Type:** Markdown file (`.md`)
- **Intelligence Requirement:** The skill must interpret the **intent**, not just the keywords.

---

## 4. Output Specification (MANDATORY Template)

# 🧪 Test Suite: {{Project/Feature Name}}

### 📌 Summary
- **Total Features Detected:** {{total_features}}
- **Total Business Rules:** {{total_business_rules}}
- **Total Test Cases Generated:** {{total_test_cases}}
- **Semantic Coverage %:** {{coverage_percentage}}%

### 📂 Test Cases
| ID | Feature | Title | Type | Priority | Preconditions | Steps | Expected Result | Test Data | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| {{id}} | {{feature}} | {{title}} | {{type}} | {{priority}} | {{preconditions}} | {{steps}} | {{expectedResult}} | {{testData}} | {{notes}} |

### 📊 Coverage Breakdown
#### 🎯 Happy Path Cases
- {{id}} --- {{title}}

#### ❌ Negative & Security Cases
- {{id}} --- {{title}}

#### ⚡ Edge & AI-Semantic Cases
- {{id}} --- {{title}}

### ⚠ Ambiguities & Risks
#### 🔎 Ambiguities & Logic Conflicts
- **{{issue}}** --- {{detail}}

#### 🚨 Risk Highlights (Inc. AI Bias/Hallucination)
- **{{risk}}** --- {{explanation}}

---

## 5. Intelligence Layer: Semantic AI Reasoning



### 🧠 A. Semantic Interpretation (Context over Keywords)
- **Synonym Recognition:** Understand that "User credentials", "Login info", and "Auth data" refer to the same entity.
- **Implicit Constraint Discovery:** Tự động suy luận biên (0, 150), kiểu dữ liệu và ngữ cảnh văn hóa cho các biến số.
- **Inference of Omissions:** Nếu có "Create" mà thiếu "Update/Delete", hệ thống sẽ tự động đặt nghi vấn.

### 🤖 B. AI-Specific Validation Logic
- **Hallucination Checks:** Kiểm tra xem AI có "chế" nội dung khi gặp input lạ không.
- **Prompt Injection:** Test các kịch bản phá vỡ rào cản (bypass attempts).
- **Probabilistic Consistency:** Kiểm tra tính ổn định của kết quả qua nhiều lần chạy.
- **Bias & Fairness:** Phát hiện định kiến về giới tính, sắc tộc trong output.

---

## 6. Workflow & Logical Rules

1.  **Step 1 — Deep Parse:** Đọc và xác định các thực thể chính.
2.  **Step 2 — Logic Extraction:** Chia nhỏ văn bản thành các quy tắc nghiệp vụ nguyên tử.
3.  **Step 3 — Scenario Expansion:** Áp dụng Phân vùng tương đương, Phân tích giá trị biên và Tư duy phản biện AI.
4.  **Step 4 — Priority Scoring:** Xếp hạng Critical/Major/Minor dựa trên tác động kinh doanh.
5.  **Step 5 — Coverage Calculation:** $$Coverage \% = \frac{\text{Logic Branches Validated}}{\text{Total Atomic Business Rules}} \times 100$$

---

## 7. Technical Constraints & Boundaries
- **Max Input:** 2MB / 10,000 words.
- **Max Output:** 500 Test Cases / 30-45s.
- **Data Privacy:** Không lưu trữ, không dùng dữ liệu người dùng để train model. 
- **Sensitive Data:** Tự động ẩn hoặc gắn cờ các Secret (API Key, Passwords).

---

## 8. Evaluation Criteria (BGK Scoring)
- **Semantic Depth:** Có tìm ra yêu cầu "ngầm" không?
- **AI Readiness:** Có các case đặc thù cho an toàn và hành vi AI không?
- **Precision:** Các bước có rõ ràng và kết quả có đo lường được không?
- **Format:** Tuân thủ 100% template Markdown đã định nghĩa.