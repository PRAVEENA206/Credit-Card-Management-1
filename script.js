 const STORE = 'creditcare_v4'
    const Storage = { load: ()=>{try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch(e){return[]}}, save: (x)=>localStorage.setItem(STORE,JSON.stringify(x)) }

    /* ---------- Step navigation (A B C D) ---------- */
    const steps = Array.from(document.querySelectorAll('.step-pill'))
    const contents = Array.from(document.querySelectorAll('.step-content'))
    let active = 1
    function setStep(n){
      active = n
      steps.forEach(s=> s.classList.toggle('active', Number(s.dataset.step)===n))
      contents.forEach(c=> c.style.display = Number(c.dataset.step)===n ? 'block' : 'none')
      // Show form page, hide eligible page when navigating steps
      document.getElementById('formPage').classList.add('active')
      document.getElementById('eligiblePage').classList.remove('active')
      window.scrollTo({top:0,behavior:'smooth'})
    }

    // next/back buttons
    document.getElementById('next1').addEventListener('click', ()=>{
      const name = document.getElementById('name').value.trim()
      if(!name){ alert('Please enter full name.'); return }
      setStep(2)
    })
    document.getElementById('skipA').addEventListener('click', ()=> setStep(2))

    document.getElementById('back2').addEventListener('click', ()=> setStep(1))
    document.getElementById('next2').addEventListener('click', ()=>{
      const addr = document.getElementById('address').value.trim()
      const mobile = document.getElementById('mobile').value.trim()
      if(!addr){ alert('Address line 1 required'); return }
      if(!/^[6-9]\d{9}$/.test(mobile)){ if(!confirm('Mobile looks invalid. Continue?')) return }
      setStep(3)
    })

    document.getElementById('back3').addEventListener('click', ()=> setStep(2))
    document.getElementById('next3').addEventListener('click', ()=>{
      const income = Number(document.getElementById('income').value)
      if(isNaN(income) || income<0){ alert('Enter valid income'); return }
      prepareReview()
      setStep(4)
    })

    document.getElementById('back4').addEventListener('click', ()=> setStep(3))

    // Clicking on pills
    steps.forEach(s=> s.addEventListener('click', ()=> setStep(Number(s.dataset.step))))

    /* ---------- Eligibility logic (transparent) ---------- */
    function computeEligibility(data){
      // Score components with clear weights:
      // Income: 0-60, Debt ratio: -20..0, Mobile valid +10, Age (optional) +10
      let incomeScore = 0
      const inc = Number(data.income || 0)
      if(inc>=100000) incomeScore = 60
      else if(inc>=50000) incomeScore = 45
      else if(inc>=30000) incomeScore = 30
      else incomeScore = 10

      const mobileValid = /^[6-9]\d{9}$/.test(data.mobile)
      const mobileScore = mobileValid ? 10 : 0

      const debt = Number(data.existingDebt || 0)
      // debtScore reduces score proportionally (max -20)
      const debtScore = Math.max(-20, Math.round(- (debt / Math.max(1, inc)) * 100 ))

      // age bonus if DOB provided (over 18 and under 65): +10
      let ageBonus = 0
      if(data.dob){
        const dob = new Date(data.dob);
        const now = new Date()
        let age = now.getFullYear() - dob.getFullYear()
        const m = now.getMonth() - dob.getMonth()
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
        if(age >= 18 && age <= 65) ageBonus = 10
      }

      let raw = incomeScore + mobileScore + debtScore + ageBonus
      const final = Math.max(0, Math.min(100, raw))

      const rationale = []
      rationale.push(`Income contribution: ${incomeScore} points`)
      rationale.push(mobileValid? 'Mobile validated: +10' : 'Mobile invalid: +0')
      rationale.push(debtScore < 0 ? `Existing debt reduces score by ${-debtScore}` : 'No debt penalty')
      if(ageBonus) rationale.push(`Age bonus: +${ageBonus}`)

      return {score: final, eligible: final >= 60, rationale}
    }

    /* ---------- Prepare review for step D ---------- */
    function prepareReview(){
      const data = collectData()
      const review = document.getElementById('reviewGrid')
      review.innerHTML = ''
      const rows = [
        ['Name', data.name || '-'],
        ['DOB', data.dob || '-'],
        ['Email', data.email || '-'],
        ['Address', data.address || '-'],
        ['City', data.city || '-'],
        ['State', data.state || '-'],
        ['Mobile', data.mobile || '-'],
        ['Employment', data.employment || '-'],
        ['Income', '₹'+(data.income||0)],
        ['Existing debt', '₹'+(data.existingDebt||0)]
      ]
      rows.forEach(r=>{
        const el = document.createElement('div')
        el.style.display='flex'
        el.style.justifyContent='space-between'
        el.style.padding='6px 8px'
        el.style.borderRadius='8px'
        el.style.background='rgba(255,255,255,0.02)'
        el.style.marginBottom='6px'
        el.innerHTML = `<div style="color:var(--muted)">${r[0]}</div><div>${escapeHtml(r[1])}</div>`
        review.appendChild(el)
      })

      const res = computeEligibility(data)
      const box = document.getElementById('eligibilityBox')
      box.style.display = 'block'
      box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>Eligibility score</strong><div style='margin-top:6px;color:var(--muted)'>A score ≥ 60 is considered eligible</div></div>
        <div style='font-size:20px;font-weight:800'>${res.score}%</div></div>
        <div style='margin-top:10px'><strong>Rationale</strong>
        <ul style='margin:6px 0 0;padding-left:18px;color:var(--muted)'>${res.rationale.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul></div>`
    }

    /* ---------- Collect form data ---------- */
    function collectData(){
      return {
        name: document.getElementById('name').value.trim(),
        dob: document.getElementById('dob').value,
        email: document.getElementById('email').value.trim(),
        address: document.getElementById('address').value.trim(),
        city: document.getElementById('city').value.trim(),
        state: document.getElementById('state').value.trim(),
        mobile: document.getElementById('mobile').value.trim(),
        income: Number(document.getElementById('income').value) || 0,
        employment: document.getElementById('employment').value,
        existingDebt: Number(document.getElementById('existingDebt').value) || 0
      }
    }

    /* ---------- Save helper (used by both Submit and Add Another) ---------- */
    function saveCustomer(data, {showConfirm=true, stay=false} = {}){
      const res = computeEligibility(data)
      data.eligibilityScore = res.score
      data.eligible = res.eligible
      data.createdAt = new Date().toISOString()
      const list = Storage.load()
      list.push(data)
      Storage.save(list)
      renderDashboard()
      if(showConfirm){
        const confirmBox = document.createElement('div')
        confirmBox.className = 'result'
        confirmBox.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>Onboarded</strong><div class='note'>${escapeHtml(data.name)} — ${data.eligible? '<span class="eligible">Eligible</span>':'<span style="color:#ffb86b">Not Eligible</span>'}</div></div>
          <div style='font-weight:800'>Score: ${data.eligibilityScore}%</div></div>`
        const main = document.querySelector('.card-right')
        main.insertBefore(confirmBox, main.children[2])
        setTimeout(()=> confirmBox.remove(), 6000)
      }
      if(stay){
        // reset form but stay on step 1 for next entry
        document.getElementById('onboardForm').reset()
        setStep(1)
      } else {
        // navigate to step 1
        document.getElementById('onboardForm').reset()
        setStep(1)
      }
    }

    /* ---------- Submit handler ---------- */
    document.getElementById('submitBtn').addEventListener('click', ()=>{
      const data = collectData()
      if(!data.name || !data.address || !data.mobile){ alert('Please complete required fields'); return }
      saveCustomer(data, {showConfirm:true, stay:false})
    })

    /* ---------- Save & Add Another ---------- */
    document.getElementById('addAnotherBtn').addEventListener('click', ()=>{
      const data = collectData()
      if(!data.name || !data.address || !data.mobile){ alert('Please complete required fields'); return }
      saveCustomer(data, {showConfirm:true, stay:true})
    })

    /* ---------- Eligible customers page render ---------- */
    function renderEligiblePage(){
      const list = Storage.load()
      const elig = list.filter(x=>x.eligible)
      const container = document.getElementById('eligibleList')
      container.innerHTML = ''
      if(!elig.length){
        container.innerHTML = '<div class="note">No eligible customers found.</div>'
        return
      }
      elig.slice().reverse().forEach(c=>{
        const el = document.createElement('div')
        el.style.display='flex'
        el.style.justifyContent='space-between'
        el.style.padding='10px'
        el.style.borderRadius='8px'
        el.style.marginBottom='8px'
        el.style.background='rgba(255,255,255,0.02)'
        el.innerHTML = `<div><strong>${escapeHtml(c.name)}</strong><div class="note">${escapeHtml(c.mobile)} • ₹${numberWithCommas(c.income||0)}</div></div><div style="text-align:right"><div style="font-weight:800">${c.eligibilityScore}%</div><div class="note">${new Date(c.createdAt).toLocaleString()}</div></div>`
        container.appendChild(el)
      })
    }

    /* ---------- Dashboard rendering ---------- */
    function renderDashboard(){
      const list = Storage.load()
      document.getElementById('statCount').innerText = list.length
      const avg = list.length? Math.round(list.reduce((s,c)=>s+(c.income||0),0)/list.length) : 0
      document.getElementById('statAvg').innerText = '₹'+numberWithCommas(avg)
      document.getElementById('statElig').innerText = list.filter(x=>x.eligible).length

      const table = document.getElementById('customersTable')
      const tbody = table.querySelector('tbody')
      tbody.innerHTML = ''
      if(list.length){
        table.style.display = '';
        list.slice().reverse().forEach(c=>{
          const tr = document.createElement('tr')
          tr.innerHTML = `<td>${escapeHtml(c.name)}</td><td>₹${numberWithCommas(c.income||0)}</td><td>${escapeHtml(c.mobile)}</td><td>${c.eligibilityScore}% ${c.eligible? '✔':''}</td>`
          tbody.appendChild(tr)
        })
      } else table.style.display = 'none'
    }

    /* ---------- Utilities ---------- */
    function escapeHtml(s){ if(s===undefined||s===null) return ''; return String(s).replace(/[&<>"']/g, (m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]) }
    function numberWithCommas(x){ return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }

    /* ---------- left buttons: view eligible / all ---------- */
    document.getElementById('viewEligBtn').addEventListener('click', ()=>{
      document.getElementById('formPage').classList.remove('active')
      document.getElementById('eligiblePage').classList.add('active')
      // hide step pills visually
      steps.forEach(s=> s.classList.remove('active'))
      contents.forEach(c=> c.style.display = 'none')
      renderEligiblePage()
    })
    document.getElementById('viewAllBtn').addEventListener('click', ()=>{
      // Show form (step 1)
      document.getElementById('eligiblePage').classList.remove('active')
      document.getElementById('formPage').classList.add('active')
      setStep(1)
      renderDashboard()
    })
    document.getElementById('backToForm').addEventListener('click', ()=>{
      document.getElementById('eligiblePage').classList.remove('active')
      document.getElementById('formPage').classList.add('active')
      setStep(1)
    })

    // initial
    setStep(1)
    renderDashboard()
